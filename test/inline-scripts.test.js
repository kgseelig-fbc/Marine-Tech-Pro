// The guard that parses the inline <script> blocks in the HTML pages.
//
// Most of this app's browser code lives inside those pages — the dashboard's
// tables, the diagnostic state machine, the fault-code search — and
// `node --check` cannot see into an HTML file, so a stray character shipped
// with CI green. These tests exist because a checker that quietly passes is
// worse than no checker: each one makes it FAIL on input it must reject.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const CHECKER = path.join(__dirname, '..', 'scripts', 'check-inline-scripts.js');

// Runs the checker against a directory of fixture pages.
function check(pages) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'mtp-inline-'));
    try {
        for (const [name, html] of Object.entries(pages)) fs.writeFileSync(path.join(dir, name), html);
        const r = spawnSync(process.execPath, [CHECKER, dir], { encoding: 'utf8' });
        return { code: r.status, out: `${r.stdout}${r.stderr}` };
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

const page = (body) => `<!doctype html>\n<html>\n<body>\n<script>\n${body}\n</script>\n</body>\n</html>\n`;

describe('inline script check', () => {
    test('passes a page whose script parses', () => {
        const r = check({ 'ok.html': page('var a = 1;\nfunction f(){ return a; }') });
        assert.equal(r.code, 0, r.out);
        assert.match(r.out, /1 blocks/);
    });

    test('fails a page with a syntax error, and names the line in the HTML file', () => {
        // page() puts the body on line 5 onwards, so the bad token is on line 6
        // of the HTML file. Reporting a line counted from the start of the
        // anonymous block instead would send a developer to the wrong place.
        const r = check({ 'broken.html': page('var a = 1;\nvar b = (;') });
        assert.equal(r.code, 1, 'a broken page must fail the check');
        assert.match(r.out, /broken\.html/);
        assert.match(r.out, /broken\.html:6/, `expected the real HTML line number in:\n${r.out}`);
    });

    test('checks a quoted type="module" block rather than skipping it', () => {
        // The first version of the checker matched the type attribute with a
        // negative lookahead behind an optional quote, which backtracked and
        // silently skipped EVERY quoted type — module scripts included.
        const r = check({ 'mod.html': '<script type="module">\nconst a = (;\n</script>\n' });
        assert.equal(r.code, 1, 'a module script is JavaScript and must be parsed');
        assert.match(r.out, /mod\.html/);
    });

    test('checks a quoted type="text/javascript" block too', () => {
        const r = check({ 'classic.html': '<script type="text/javascript">\nvar x = {;\n</script>\n' });
        assert.equal(r.code, 1);
    });

    test('skips blocks that are data, not script', () => {
        const r = check({
            'data.html': '<script type="application/ld+json">{ "@type": "Thing" }</script>\n'
                       + '<script src="/js/common.js"></script>\n'
                       + page('var ok = 1;')
        });
        assert.equal(r.code, 0, r.out);
        assert.match(r.out, /1 blocks/, 'only the real script block counts');
    });

    test('fails when it finds nothing to check', () => {
        // A green tick over zero blocks is how this guard would quietly stop
        // guarding — if the pages move, or the matcher stops matching.
        const r = check({ 'empty.html': '<html><body>no scripts here</body></html>' });
        assert.equal(r.code, 1);
        assert.match(r.out, /not looking at anything/);
    });

    test('the real pages pass, and there are several of them', () => {
        const r = spawnSync(process.execPath, [CHECKER], { encoding: 'utf8' });
        assert.equal(r.status, 0, `${r.stdout}${r.stderr}`);
        const m = /(\d+) blocks/.exec(r.stdout);
        assert.ok(m && Number(m[1]) >= 5,
            `expected the shipped pages to contribute several blocks, got: ${r.stdout}`);
    });
});
