#!/usr/bin/env node
// Syntax-check the inline <script> blocks in the HTML pages.
//
// Every page in public/ carries its own inline script, and that is where most
// of this app's browser code lives — the dashboard's tables, the diagnostic
// state machine, the fault-code search. `node --check` covers public/js/*.js
// but cannot see inside an HTML file, so until now a stray character in a page
// script shipped silently and broke that page in the field, with the tests and
// CI both green.
//
// Parse only: the blocks reference `document` and `window`, so they are
// compiled and thrown away, never run.

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;

// Line number of a match, so an error points at the real line in the HTML file
// rather than at line 3 of an anonymous block.
function lineOf(text, index) {
    return text.slice(0, index).split('\n').length;
}

let blocks = 0;
let failures = 0;

for (const file of fs.readdirSync(PUBLIC_DIR).filter((f) => f.endsWith('.html')).sort()) {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, file), 'utf8');
    let m;
    SCRIPT_RE.lastIndex = 0;
    while ((m = SCRIPT_RE.exec(html)) !== null) {
        // <script src="..."> has no body of its own to check.
        if (/\bsrc\s*=/i.test(m[1])) continue;
        // JSON-LD and other data blocks are not JavaScript.
        if (/\btype\s*=\s*["']?(?!text\/javascript|module|application\/javascript)/i.test(m[1])) continue;
        if (!m[2].trim()) continue;

        blocks++;
        const line = lineOf(html, m.index);
        try {
            // Prefix the source with blank lines so reported line numbers match
            // the HTML file.
            new vm.Script('\n'.repeat(line - 1) + m[2], { filename: `public/${file}` });
        } catch (e) {
            failures++;
            console.error(`✗ public/${file}: ${e.message}`);
        }
    }
}

if (failures) {
    console.error(`\n${failures} inline script block(s) failed to parse.`);
    process.exit(1);
}
console.log(`✓ inline scripts OK — ${blocks} blocks across public/*.html`);
