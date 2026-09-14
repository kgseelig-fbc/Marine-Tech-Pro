// Graceful shutdown tests.
//
// Railway sends SIGTERM on every redeploy. shutdown() must drain in-flight
// requests, close SQLite so the WAL is checkpointed, and exit 0 — a non-zero
// exit on a clean redeploy is reported as a failed deploy, and a hung drain
// (a ref'd timer plus a removed process.exit) would sit there until the
// platform's SIGKILL. The other suites tear their servers down with SIGTERM
// too and assert exit 0, so this file only covers what they cannot: what an
// in-flight request sees while the drain is running.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const net = require('node:net');
const H = require('./helpers');

// A raw keep-alive socket that has sent a POST's headers but not its body:
// express.json() is waiting on raw-body, so the request is in flight and
// server.close() cannot finish until it completes or the drain times out.
async function stalledRequest(port) {
    const sock = net.connect(port, '127.0.0.1');
    await new Promise((resolve, reject) => { sock.once('connect', resolve); sock.once('error', reject); });
    let received = '';
    sock.on('data', (c) => { received += c; });
    sock.on('error', () => { /* reset on process exit is expected */ });
    sock.write('POST /api/event HTTP/1.1\r\nHost: 127.0.0.1\r\nContent-Type: application/json\r\nContent-Length: 10\r\n\r\n');
    return {
        sock,
        received: () => received,
        // Complete the body (exactly 10 bytes) so the request can finish.
        finish: () => sock.write('{"kind":1}'),
        close: () => sock.destroy()
    };
}

describe('graceful shutdown', () => {
    test('SIGTERM drains, closes the database and exits 0 with "Shutdown complete"', async () => {
        const app = await H.startServer();
        try {
            // Leave an idle keep-alive socket open, as every browser does;
            // server.close() must not wait on it.
            assert.equal((await H.get(app.base, '/api/health')).status, 200);

            const started = Date.now();
            const { code, signal } = await app.stop();
            const took = Date.now() - started;

            assert.equal(code, 0, `expected a clean exit:\n${app.output()}`);
            assert.equal(signal, null, 'must exit on its own, not be killed');
            assert.ok(took < 10000, `shutdown took ${took} ms`);
            assert.match(app.output(), /SIGTERM received — draining connections/);
            assert.match(app.output(), /Shutdown complete\./);
            assert.ok(!/Drain timed out/.test(app.output()), 'an idle server must not need the drain timeout');
        } finally {
            app.rm();
        }
    });

    test('while draining, /api/health over a live keep-alive socket says 503 draining and closes it', async () => {
        // server.close() stops NEW connections, but a balancer probing over a
        // pooled socket kept routing techs to a process about to exit. The
        // health route must say so, and Connection: close drops that socket.
        const app = await H.startServer();
        const req = await stalledRequest(app.port);
        try {
            await H.sleep(100);
            const stopping = app.stop();
            await app.waitForOutput(/draining connections/);

            // Now finish the in-flight request and pipeline a health probe on
            // the same socket — the only kind of request that can still reach
            // a draining process.
            req.finish();
            req.sock.write('GET /api/health HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n');

            const { code } = await stopping;
            assert.equal(code, 0, app.output());
            assert.match(app.output(), /Shutdown complete\./, 'the completed request lets the drain finish cleanly');

            const got = req.received();
            assert.match(got, /HTTP\/1\.1 401/, 'the stalled beacon POST was answered (anonymous)');
            assert.match(got, /HTTP\/1\.1 503/, 'the health probe must be refused while draining');
            assert.match(got, /"status":"draining"/);
            assert.match(got, /Connection: close/i, 'the draining response must drop the pooled socket');
        } finally {
            req.close();
            app.rm();
        }
    });

    test('a stalled request cannot hold the drain past DRAIN_TIMEOUT_MS, and the timeout still exits 0', async () => {
        // A timed-out drain is an expected outcome on a redeploy, not a
        // crash: exiting non-zero here would flag every busy redeploy as failed.
        const app = await H.startServer({ env: { DRAIN_TIMEOUT_MS: '300' } });
        const req = await stalledRequest(app.port);
        try {
            await H.sleep(100);
            const started = Date.now();
            const { code, signal } = await app.stop();
            const took = Date.now() - started;

            assert.equal(code, 0, `expected exit 0 on a timed-out drain:\n${app.output()}`);
            assert.equal(signal, null);
            assert.ok(took >= 250 && took < 5000, `expected the 300 ms drain window to elapse, took ${took} ms`);
            assert.match(app.output(), /Drain timed out — exiting\./);
            assert.ok(!/Shutdown complete/.test(app.output()), 'server.close() never completed, so this must be the timeout path');
        } finally {
            req.close();
            app.rm();
        }
    });
});
