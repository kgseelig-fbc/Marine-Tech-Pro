// Icon and manifest integrity.
//
// The original defect: manifest.json declared a single 2000x2000 JPEG as both
// the 192x192 and the 512x512 icon. The sizes were simply false, there was no
// maskable variant, and the same 474 KB file was the favicon on every page.
// These tests assert the declarations match the bytes on disk, so a wrong
// `sizes` string or a missing file fails CI instead of shipping.
//
// Deliberately dependency-free: PNG dimensions come from the IHDR header, so
// this runs in CI without sharp (which is only needed to regenerate icons).

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const PUBLIC = path.join(ROOT, 'public');
const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.json'), 'utf8'));

// Width/height live at fixed offsets in the IHDR chunk of every PNG.
function pngSize(file) {
    const buf = fs.readFileSync(file);
    assert.equal(buf.readUInt32BE(0), 0x89504e47, `${file} is not a PNG`);
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function publicPath(src) {
    return path.join(PUBLIC, src.replace(/^\//, ''));
}

describe('manifest icons', () => {
    test('declares at least one "any" and one "maskable" icon', () => {
        const purposes = manifest.icons.map((i) => i.purpose);
        assert.ok(purposes.includes('any'), 'no purpose:any icon declared');
        assert.ok(purposes.includes('maskable'), 'no purpose:maskable icon declared');
    });

    test('every declared icon exists and its real size matches the declaration', () => {
        for (const icon of manifest.icons) {
            const file = publicPath(icon.src);
            assert.ok(fs.existsSync(file), `${icon.src} declared in manifest but missing on disk`);

            const { width, height } = pngSize(file);
            assert.equal(
                `${width}x${height}`,
                icon.sizes,
                `${icon.src} declares sizes="${icon.sizes}" but is actually ${width}x${height}`
            );
            assert.equal(icon.type, 'image/png', `${icon.src} should declare image/png`);
        }
    });

    test('provides both 192 and 512 in each purpose', () => {
        for (const purpose of ['any', 'maskable']) {
            const sizes = manifest.icons.filter((i) => i.purpose === purpose).map((i) => i.sizes);
            assert.ok(sizes.includes('192x192'), `missing 192x192 for purpose:${purpose}`);
            assert.ok(sizes.includes('512x512'), `missing 512x512 for purpose:${purpose}`);
        }
    });

    // The original defect lived in the FAVICON, not the manifest — a 474 KB
    // JPEG pulled on every page load. Budget every shipped raster icon,
    // wherever it is referenced from, not just the four manifest entries.
    test('every shipped raster icon is a real PNG within a sane byte budget', () => {
        const referenced = new Set(manifest.icons.map((i) => i.src));

        for (const page of fs.readdirSync(PUBLIC).filter((f) => f.endsWith('.html'))) {
            const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
            for (const m of html.matchAll(/(?:href|src)=(["'])((?:\/)?icons\/[^"']+)\1/g)) {
                referenced.add('/' + m[2].replace(/^\//, ''));
            }
        }
        const sw = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');
        for (const m of sw.matchAll(/["'](\/icons\/[^"']+)["']/g)) referenced.add(m[1]);

        const rasters = [...referenced].map((r) => r.split('#')[0]).filter((r) => !r.endsWith('.svg'));
        assert.ok(rasters.length >= 5, `expected the full icon set, found ${rasters.length}`);

        for (const ref of rasters) {
            const file = publicPath(ref);
            assert.ok(fs.existsSync(file), `${ref} is referenced but missing`);
            pngSize(file); // also asserts the PNG magic number
            const bytes = fs.statSync(file).size;
            assert.ok(bytes < 80 * 1024, `${ref} is ${bytes} B — too large to ship on cell data`);
        }
    });

    test('no icon in the served directory is orphaned', () => {
        const referenced = new Set(manifest.icons.map((i) => i.src.replace('/icons/', '')));
        const all = [
            ...fs.readdirSync(PUBLIC).filter((f) => f.endsWith('.html'))
                .map((p) => fs.readFileSync(path.join(PUBLIC, p), 'utf8')),
            fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8'),
            fs.readFileSync(path.join(PUBLIC, 'css', 'styles.css'), 'utf8')
        ].join('\n');

        for (const file of fs.readdirSync(path.join(PUBLIC, 'icons'))) {
            assert.ok(
                referenced.has(file) || all.includes(file),
                `public/icons/${file} is not referenced anywhere — dead weight in the deploy`
            );
        }
    });
});

describe('page icon references', () => {
    const pages = fs.readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));

    test('every icon referenced by an HTML page exists on disk', () => {
        assert.ok(pages.length > 0, 'no HTML pages found');
        for (const page of pages) {
            const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
            // Accept either quote style — anchoring to one silently skips the other.
            const refs = [...html.matchAll(/(?:href|src)=(["'])(\/icons\/[^"']+)\1/g)].map((m) => m[2]);
            for (const ref of refs) {
                // sprite.svg is referenced with #fragment ids for <use>.
                const clean = ref.split('#')[0];
                assert.ok(
                    fs.existsSync(publicPath(clean)),
                    `${page} references ${clean} which does not exist`
                );
            }
        }
    });

    test('no page still points at the retired 2000x2000 master', () => {
        for (const page of pages) {
            const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
            assert.ok(
                !html.includes('fbc-logo.jpeg'),
                `${page} still references fbc-logo.jpeg — the master lives in assets/ and is not served`
            );
        }
    });

    test('the master artwork is not inside the served directory', () => {
        assert.ok(
            !fs.existsSync(path.join(PUBLIC, 'icons', 'fbc-logo.jpeg')),
            'the 474 KB master should live in assets/, not public/'
        );
        assert.ok(
            fs.existsSync(path.join(ROOT, 'assets', 'fbc-logo-master.jpeg')),
            'master artwork missing — icons could not be regenerated'
        );
    });
});

describe('service worker icon precache', () => {
    const sw = fs.readFileSync(path.join(PUBLIC, 'sw.js'), 'utf8');

    test('every precached /icons/ URL exists on disk', () => {
        const refs = [...sw.matchAll(/["'](\/icons\/[^"']+)["']/g)].map((m) => m[1]);
        assert.ok(refs.length > 0, 'no icons precached');
        for (const ref of refs) {
            assert.ok(fs.existsSync(publicPath(ref)), `sw.js precaches ${ref} which does not exist`);
        }
    });

    // Assert the BEHAVIOUR, not the source text: grepping for the regex would
    // still pass if the guard were deleted and only a comment left behind.
    test('an HTML body served under a .png URL is not cached as the icon', () => {
        const vm = require('node:vm');
        const sandbox = {
            self: { addEventListener() {}, location: { origin: 'https://app.example.com' } },
            caches: { open: () => Promise.resolve({}), keys: () => Promise.resolve([]) },
            fetch: () => Promise.resolve(),
            URL,
            Request: class { constructor(u, o) { this.url = u; Object.assign(this, o || {}); } },
            Response: class { constructor(b, i) { this.body = b; Object.assign(this, i || {}); } },
            Promise,
            console
        };
        vm.createContext(sandbox);
        vm.runInContext(sw, sandbox, { filename: 'sw.js' });
        const isCacheable = vm.runInContext('isCacheable', sandbox);

        const req = (u) => ({ url: u, mode: 'no-cors', headers: { get: () => '*/*' } });
        const res = (ct) => ({ ok: true, type: 'basic', redirected: false, headers: { get: () => ct } });

        assert.equal(
            isCacheable(req('https://app.example.com/icons/icon-192.png'), res('text/html; charset=UTF-8')),
            false,
            'an HTML error page would be cached and served as the app icon'
        );
        assert.equal(
            isCacheable(req('https://app.example.com/icons/icon-192.png'), res('image/png')),
            true,
            'a genuine PNG must still be cacheable'
        );
    });
});
