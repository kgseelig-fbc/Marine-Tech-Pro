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

    test('icons are small enough to ship to a phone on cell data', () => {
        for (const icon of manifest.icons) {
            const bytes = fs.statSync(publicPath(icon.src)).size;
            assert.ok(bytes < 150 * 1024, `${icon.src} is ${bytes} B — too large for an icon`);
        }
    });
});

describe('page icon references', () => {
    const pages = fs.readdirSync(PUBLIC).filter((f) => f.endsWith('.html'));

    test('every icon referenced by an HTML page exists on disk', () => {
        assert.ok(pages.length > 0, 'no HTML pages found');
        for (const page of pages) {
            const html = fs.readFileSync(path.join(PUBLIC, page), 'utf8');
            const refs = [...html.matchAll(/(?:href|src)="(\/icons\/[^"]+)"/g)].map((m) => m[1]);
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
        const refs = [...sw.matchAll(/'(\/icons\/[^']+)'/g)].map((m) => m[1]);
        assert.ok(refs.length > 0, 'no icons precached');
        for (const ref of refs) {
            assert.ok(fs.existsSync(publicPath(ref)), `sw.js precaches ${ref} which does not exist`);
        }
    });

    test('image responses are content-type checked before caching', () => {
        // Without this guard an HTML error body served under a .png URL would
        // be cached as if it were the icon.
        assert.match(sw, /png\|jpe\?g/, 'isCacheable has no image content-type guard');
    });
});
