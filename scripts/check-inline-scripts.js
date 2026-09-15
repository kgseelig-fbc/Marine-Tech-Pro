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

// Defaults to the shipped pages; a directory argument lets the tests point it
// at a fixture and assert it actually fails on a broken block.
const PUBLIC_DIR = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, '..', 'public');
const SCRIPT_RE = /<script\b([^>]*)>([\s\S]*?)<\/script>/gi;
const TYPE_RE = /\btype\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
// Types the browser executes as script. Anything else in a <script> (JSON-LD,
// an HTML template, importmap) is data and is not parsed as JavaScript.
const JS_TYPES = new Set(['', 'module', 'text/javascript', 'application/javascript', 'text/ecmascript', 'application/ecmascript']);

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
        // JSON-LD and other data blocks are not JavaScript. Parse the attribute
        // rather than pattern-matching it: a negative lookahead behind an
        // optional quote silently skipped every quoted type, `type="module"`
        // included, which is the case most worth checking.
        const typeMatch = TYPE_RE.exec(m[1]);
        const type = typeMatch ? (typeMatch[1] || typeMatch[2] || typeMatch[3] || '').trim().toLowerCase() : '';
        if (!JS_TYPES.has(type)) continue;
        if (!m[2].trim()) continue;

        blocks++;
        const line = lineOf(html, m.index);
        try {
            // Prefix the source with blank lines so reported line numbers match
            // the HTML file.
            new vm.Script('\n'.repeat(line - 1) + m[2], { filename: path.join(path.basename(PUBLIC_DIR), file) });
        } catch (e) {
            failures++;
            // The first stack frame carries `file:line` — the whole point of
            // padding the source above. e.message alone would drop it.
            const where = String(e.stack || '').split('\n')[0];
            console.error(`✗ ${file}: ${e.message}${where && where.includes(file) ? ` (${where.trim()})` : ''}`);
        }
    }
}

if (failures) {
    console.error(`\n${failures} inline script block(s) failed to parse.`);
    process.exit(1);
}
// A green tick over nothing is worse than no check: if the pages move, or the
// matcher stops matching, this must fail rather than report success.
if (blocks === 0) {
    console.error(`✗ no inline script blocks found in ${PUBLIC_DIR} — this check is not looking at anything.`);
    process.exit(1);
}
console.log(`✓ inline scripts OK — ${blocks} blocks across ${path.basename(PUBLIC_DIR)}/*.html`);
