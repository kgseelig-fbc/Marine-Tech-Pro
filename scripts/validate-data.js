#!/usr/bin/env node
// Validates the hand-maintained domain data files.
//
// The diagnostic trees are ~270 KB of hand-edited nodes wired together by
// string ids, and a broken reference is invisible until a technician hits it
// in the field. This runs in a second and catches that class of bug.
//
// Usage: npm run validate  (exits non-zero on any problem)

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const problems = [];
function problem(msg) { problems.push(msg); }

// Load the browser data files into a sandboxed `window`.
function loadDataFiles() {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    for (const f of ['diagnosticTrees.js', 'engineSpecs.js', 'faultcodes.js']) {
        const src = fs.readFileSync(path.join(ROOT, 'public', 'js', f), 'utf8');
        vm.runInContext(src, sandbox, { filename: f });
    }
    return sandbox.window;
}

function validateTrees(trees) {
    if (!trees || typeof trees !== 'object') {
        problem('window.defined_trees is missing');
        return;
    }
    for (const [name, tree] of Object.entries(trees)) {
        const nodes = tree.nodes;
        if (!nodes || typeof nodes !== 'object') {
            problem(`${name}: no nodes map`);
            continue;
        }
        if (!tree.title) problem(`${name}: missing title`);
        if (!tree.startNode) problem(`${name}: missing startNode`);
        else if (!nodes[tree.startNode]) problem(`${name}: startNode "${tree.startNode}" does not exist`);

        for (const [id, node] of Object.entries(nodes)) {
            const targets = (node.options || []).map(o => o.next).concat(node.next ? [node.next] : []);

            for (const t of targets) {
                if (!t) problem(`${name}/${id}: option with empty next`);
                else if (!nodes[t]) problem(`${name}/${id}: broken reference -> "${t}"`);
            }
            if (node.type === 'resolution') {
                if (targets.length) problem(`${name}/${id}: resolution should be terminal but has ${targets.length} exit(s)`);
                if (!node.title) problem(`${name}/${id}: resolution missing title`);
            } else {
                // Every non-resolution node must lead somewhere, or the tech
                // lands on a screen with only a Back button.
                if (targets.length === 0) problem(`${name}/${id}: type "${node.type}" is a dead end (no options/next)`);
                if (node.type === 'question' && (node.options || []).length < 2) {
                    problem(`${name}/${id}: question node has fewer than 2 options`);
                }
            }
            if (!node.text) problem(`${name}/${id}: missing text`);
        }

        // Reachability from startNode.
        const seen = new Set();
        const queue = [tree.startNode];
        while (queue.length) {
            const id = queue.pop();
            if (!id || seen.has(id)) continue;
            seen.add(id);
            const n = nodes[id];
            if (!n) continue;
            (n.options || []).forEach(o => queue.push(o.next));
            if (n.next) queue.push(n.next);
        }
        for (const id of Object.keys(nodes)) {
            if (!seen.has(id)) problem(`${name}/${id}: unreachable from startNode`);
        }

        // Every reachable node must be able to reach a resolution.
        const canResolve = new Set();
        let changed = true;
        while (changed) {
            changed = false;
            for (const [id, n] of Object.entries(nodes)) {
                if (canResolve.has(id)) continue;
                if (n.type === 'resolution') { canResolve.add(id); changed = true; continue; }
                const targets = (n.options || []).map(o => o.next).concat(n.next ? [n.next] : []);
                if (targets.some(t => canResolve.has(t))) { canResolve.add(id); changed = true; }
            }
        }
        for (const id of seen) {
            if (!canResolve.has(id)) problem(`${name}/${id}: cannot reach any resolution`);
        }
    }
}

// Every tree must be startable from the UI, and every menu card must exist.
function validateMenuCoverage(trees) {
    const html = fs.readFileSync(path.join(ROOT, 'public', 'diagnose.html'), 'utf8');
    const carded = new Set([...html.matchAll(/beginTree\('([a-zA-Z0-9_]+)'\)/g)].map(m => m[1]));
    for (const name of Object.keys(trees || {})) {
        if (!carded.has(name)) problem(`tree "${name}" has no menu card in diagnose.html (unreachable from the UI)`);
    }
    for (const name of carded) {
        if (!trees || !trees[name]) problem(`diagnose.html has a menu card for "${name}" but no such tree exists`);
    }
}

function validateFaultCodes(codes) {
    if (!Array.isArray(codes)) {
        problem('window.faultCodeDatabase is missing or not an array');
        return;
    }
    const SEVERITIES = new Set(['Warning', 'Alarm', 'Shutdown']);
    const seen = new Map();
    for (const [i, c] of codes.entries()) {
        const where = `faultcode[${i}] ${c.code || '(no code)'}`;
        for (const field of ['code', 'manufacturer', 'severity', 'system', 'description', 'causes', 'steps', 'tools', 'parts']) {
            if (!c[field] || String(c[field]).trim() === '') problem(`${where}: missing/empty "${field}"`);
        }
        if (c.severity && !SEVERITIES.has(c.severity)) {
            problem(`${where}: severity "${c.severity}" not one of ${[...SEVERITIES].join('/')}`);
        }
        const key = `${c.manufacturer}:${c.code}`;
        if (seen.has(key)) problem(`${where}: duplicate code (also at index ${seen.get(key)})`);
        else seen.set(key, i);
    }
}

function validateSpecs(specs) {
    if (!Array.isArray(specs)) {
        problem('window.engineSpecDatabase is missing or not an array');
        return;
    }
    if (specs.length === 0) problem('engineSpecDatabase is empty');
}

const win = loadDataFiles();
validateTrees(win.defined_trees);
validateMenuCoverage(win.defined_trees);
validateFaultCodes(win.faultCodeDatabase);
validateSpecs(win.engineSpecDatabase);

const treeCount = Object.keys(win.defined_trees || {}).length;
const nodeCount = Object.values(win.defined_trees || {})
    .reduce((n, t) => n + Object.keys(t.nodes || {}).length, 0);

if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s) found:\n`);
    for (const p of problems) console.error('  - ' + p);
    process.exit(1);
}
console.log(`✓ data OK — ${treeCount} trees, ${nodeCount} nodes, ` +
    `${(win.faultCodeDatabase || []).length} fault codes, ` +
    `${(win.engineSpecDatabase || []).length} engine specs`);
