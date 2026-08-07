#!/usr/bin/env node
//
// Regenerates public/icons/* from the high-res master in assets/.
//
//   npm install --no-save sharp && node scripts/generate-icons.js
//
// sharp is NOT a runtime dependency — it is only needed when the master
// artwork changes. The generated PNGs are committed, so a normal install
// and deploy never touches it.
//
// MASKABLE ICONS
// Android (and any platform honouring `purpose: "maskable"`) crops the icon
// to a platform-chosen shape: circle, squircle, rounded square, teardrop.
// Only a centred circle with 80% of the icon's diameter — the "safe zone" —
// is guaranteed to survive. The FBC badge is a circle whose rim carries the
// "FREEDOM BOAT CLUB" wordmark right up to the edge of the square, so a
// full-bleed maskable icon would have that wordmark sliced off by every mask.
// The maskable variants therefore scale the badge to 80% and pad with the
// logo's own white surround, which bleeds to all four edges.
//
// The `purpose: "any"` icons stay full-bleed: nothing crops them, and the
// badge should fill the space where it is shown intact.

const path = require('path');
const fs = require('fs');

let sharp;
try {
    sharp = require('sharp');
} catch (err) {
    console.error('sharp is not installed. Run:\n  npm install --no-save sharp');
    process.exit(1);
}

const MASTER = path.join(__dirname, '..', 'assets', 'fbc-logo-master.jpeg');
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

// Fraction of the canvas the badge occupies in a maskable icon.
// The spec's safe zone is a centred circle of 0.8 diameter. Drawing the badge
// at exactly 0.8 puts its edge precisely ON that boundary, where antialiasing
// spills a fraction of a pixel outside — so the badge is drawn slightly
// smaller to leave real margin instead of relying on a zero-tolerance fit.
const SAFE_ZONE = 0.8;      // spec boundary — what verification asserts against
const BADGE_SCALE = 0.78;   // what we actually draw

// The logo's native surround. Keeping it white preserves the thin navy
// outer stroke of the badge, which would disappear against a navy fill.
const PAD_COLOR = '#ffffff';

const PNG_OPTS = { compressionLevel: 9, effort: 10, palette: true, quality: 90 };

// [filename, pixel size, maskable?]
const TARGETS = [
    ['icon-192.png', 192, false],
    ['icon-512.png', 512, false],
    ['icon-maskable-192.png', 192, true],
    ['icon-maskable-512.png', 512, true],
    ['apple-touch-icon.png', 180, false],
    ['logo-256.png', 256, false],
    ['favicon-32.png', 32, false],
    ['favicon-16.png', 16, false]
];

async function build(name, size, maskable) {
    const dest = path.join(OUT_DIR, name);
    let img;

    if (maskable) {
        const inner = Math.round(size * BADGE_SCALE);
        const pad = size - inner;
        const left = Math.floor(pad / 2);
        const top = Math.floor(pad / 2);
        img = sharp(MASTER)
            .resize(inner, inner, { kernel: 'lanczos3', fit: 'contain', background: PAD_COLOR })
            .extend({
                top,
                left,
                bottom: pad - top,
                right: pad - left,
                background: PAD_COLOR
            });
    } else {
        img = sharp(MASTER).resize(size, size, { kernel: 'lanczos3', fit: 'contain', background: PAD_COLOR });
    }

    // flatten(): the master is JPEG (no alpha), but flattening guarantees a
    // fully opaque result even if the master is ever replaced with a PNG/SVG.
    await img.flatten({ background: PAD_COLOR }).png(PNG_OPTS).toFile(dest);

    const meta = await sharp(dest).metadata();
    const bytes = fs.statSync(dest).size;
    if (meta.width !== size || meta.height !== size) {
        throw new Error(`${name}: expected ${size}x${size}, got ${meta.width}x${meta.height}`);
    }

    let margin = null;
    if (maskable) {
        margin = await assertInsideSafeZone(dest, name);
    }
    return { name, size, maskable, bytes, margin, dims: `${meta.width}x${meta.height}` };
}

// Verify no ink lands outside the maskable safe zone. Cheap insurance against
// a bad BADGE_SCALE silently shipping an icon whose wordmark gets cropped —
// which is the exact defect these variants exist to prevent.
async function assertInsideSafeZone(file, name) {
    const { data, info } = await sharp(file).raw().toBuffer({ resolveWithObject: true });
    const { width: w, height: h, channels } = info;
    const cx = (w - 1) / 2;
    const cy = (h - 1) / 2;
    const safeR = w * (SAFE_ZONE / 2);
    let maxD = 0;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const i = (y * w + x) * channels;
            // Anything meaningfully darker than the white surround is "ink".
            if (data[i] < 245 || data[i + 1] < 245 || data[i + 2] < 245) {
                const d = Math.hypot(x - cx, y - cy);
                if (d > maxD) maxD = d;
            }
        }
    }
    if (maxD > safeR) {
        throw new Error(
            `${name}: content reaches r=${maxD.toFixed(1)}px but the maskable safe zone ` +
            `is r=${safeR.toFixed(1)}px — a mask would crop the wordmark. Lower BADGE_SCALE.`
        );
    }
    return safeR - maxD;
}

(async () => {
    if (!fs.existsSync(MASTER)) {
        console.error(`Master artwork not found: ${MASTER}`);
        process.exit(1);
    }
    fs.mkdirSync(OUT_DIR, { recursive: true });

    const master = await sharp(MASTER).metadata();
    console.log(`master: ${master.width}x${master.height} ${master.format}, ${fs.statSync(MASTER).size} bytes\n`);

    const rows = [];
    for (const [name, size, maskable] of TARGETS) {
        rows.push(await build(name, size, maskable));
    }

    let total = 0;
    for (const r of rows) {
        total += r.bytes;
        console.log(
            `  ${r.name.padEnd(24)} ${r.dims.padEnd(9)} ${String(r.bytes).padStart(7)} B` +
            (r.maskable
                ? `  (badge ${Math.round(BADGE_SCALE * 100)}%, ${r.margin.toFixed(1)}px inside safe zone)`
                : '')
        );
    }
    console.log(`\n  ${rows.length} files, ${total} bytes total`);
})().catch((err) => {
    console.error(err);
    process.exit(1);
});
