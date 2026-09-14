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

const NODE_TYPES = new Set(['question', 'instruction', 'resolution']);
// diagnose.html colours a resolution by 'severity-' + severity.toLowerCase()
// and only has CSS for these four; anything else silently renders uncoloured.
const RESOLUTION_SEVERITIES = new Set(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
const FAULT_SEVERITIES = new Set(['Warning', 'Alarm', 'Shutdown', 'Info']);
const MANUFACTURERS = new Set(['Mercury', 'Yamaha']);
// Every field specs.html renders (makeRow) plus the picker fields. A missing
// one renders '—' or 'undefined' with no error, so all are required.
const SPEC_STRING_FIELDS = [
    'name', 'manufacturer', 'years', 'yearsShort', 'cylinders', 'displacement',
    'fuelSystem', 'ignition', 'firingOrder', 'gearRatio', 'controlSystem', 'diagnosticTool',
    'idleNeutral', 'idleInGear', 'wotRange', 'sparkPlug', 'sparkGap', 'sparkTorque',
    'fuelPressure', 'injectorResistance', 'compressionNormal', 'compressionMin', 'compressionVariation',
    'oilType', 'oilCapacity', 'oilPressureIdle', 'oilPressureWOT',
    'thermostatOpens', 'normalTemp', 'overheatAlarm',
    'chargingType', 'chargingOutput', 'chargingVoltage', 'gearOilCapacity', 'gearOilType',
];

function isNonEmptyString(v) { return typeof v === 'string' && v.trim() !== ''; }

// Load the browser data files into a sandboxed `window`. The Yamaha factory
// corpus lives in kb/ (server-side prompt grounding, never served) but has
// the same window.* wrapper, so it loads the same way for the unit checks.
function loadDataFiles() {
    const sandbox = { window: {}, console };
    vm.createContext(sandbox);
    const files = [
        path.join('public', 'js', 'diagnosticTrees.js'),
        path.join('public', 'js', 'engineSpecs.js'),
        path.join('public', 'js', 'faultcodes.js'),
        path.join('kb', 'yamahaManuals.js'),
    ];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
        vm.runInContext(src, sandbox, { filename: path.basename(f) });
    }
    return sandbox.window;
}

// ---------------------------------------------------------------------------
// Unit pairs. A tech compares a gauge reading against whichever unit the
// gauge shows, so both halves of a printed pair must describe the same
// threshold (880 kPa once read 128 PSI on one entry and 125 on another).
//   "<n> kPa (… <m> PSI)"     within 1.5 PSI  (gauge resolution)
//   "<n> Nm (… <m> ft-lb)"    within 3 % or 1 ft-lb, whichever is larger
//                             (Yamaha prints Nm rounded from m·kgf and ft-lb
//                             as an integer — "42 Nm (30 ft-lb)" is the
//                             manual's own rounding; the printed pair stays)
//   "<n> cc / <m> US oz", "<n> L / <m> US oz", "<n> L (… <m> US qt)"  within 2 %
// ---------------------------------------------------------------------------
const NUM = '(\\d+(?:\\.\\d+)?)';
const UNIT_PAIRS = [
    { name: 'kPa/PSI', re: new RegExp(NUM + '\\s*kPa\\s*\\([^)]*?~?' + NUM + '\\s*psi\\)', 'gi'),
      conv: kPa => kPa * 0.1450377, absTol: 1.5, unit: 'PSI' },
    { name: 'Nm/ft-lb', re: new RegExp(NUM + '\\s*Nm\\s*\\([^)]*?~?' + NUM + '\\s*ft-lb\\)', 'g'),
      conv: nm => nm * 0.7375621, relTol: 0.03, absFloor: 1, unit: 'ft-lb' },
    { name: 'cc/US oz', re: new RegExp(NUM + '\\s*(?:cc|cm³)\\s*(?:/|\\([^)]*?)\\s*~?' + NUM + '\\s*US oz', 'g'),
      conv: cc => cc / 29.5735, relTol: 0.02, unit: 'US oz' },
    { name: 'L/US oz', re: new RegExp(NUM + '\\s*L\\s*/\\s*~?' + NUM + '\\s*US oz', 'g'),
      conv: l => l * 1000 / 29.5735, relTol: 0.02, unit: 'US oz' },
    { name: 'L/US qt', re: new RegExp(NUM + '\\s*L\\s*\\([^)]*?~?' + NUM + '\\s*US qt\\)', 'g'),
      conv: l => l * 1.056688, relTol: 0.02, unit: 'US qt' },
];
let unitPairsChecked = 0;

function checkUnitPairs(text, where) {
    if (typeof text !== 'string') return;
    for (const p of UNIT_PAIRS) {
        p.re.lastIndex = 0;
        let m;
        while ((m = p.re.exec(text))) {
            unitPairsChecked++;
            const a = parseFloat(m[1]);
            const b = parseFloat(m[2]);
            const expect = p.conv(a);
            const off = Math.abs(expect - b);
            const bad = p.absTol !== undefined
                ? off > p.absTol
                : off / expect > p.relTol && off > (p.absFloor || 0);
            if (bad) {
                problem(`${where}: unit pair "${m[0]}" — ${a} converts to ${expect.toFixed(1)} ${p.unit}, not ${b}`);
            }
        }
    }
}

// Walk every string inside a node / entry (checklists, notes, measurement…).
function walkStrings(value, fn) {
    if (typeof value === 'string') fn(value);
    else if (Array.isArray(value)) value.forEach(v => walkStrings(v, fn));
    else if (value && typeof value === 'object') Object.values(value).forEach(v => walkStrings(v, fn));
}

// jumpTo is a cross-tree / cross-page hand-off button rendered only on
// resolutions: { tree, label } starts another tree, { href, label } leaves
// the page. A renamed tree must fail here, not on a tech's phone.
function validateJumpTo(where, jump, trees) {
    if (!jump || typeof jump !== 'object') { problem(`${where}: jumpTo is not an object`); return; }
    const hasTree = jump.tree !== undefined;
    const hasHref = jump.href !== undefined;
    if (hasTree === hasHref) problem(`${where}: jumpTo needs exactly one of tree/href`);
    if (hasTree && !(trees && trees[jump.tree])) problem(`${where}: jumpTo.tree "${jump.tree}" does not exist`);
    if (hasHref && !(isNonEmptyString(jump.href) && jump.href.startsWith('/'))) {
        problem(`${where}: jumpTo.href must be a site-relative path starting with "/"`);
    }
    if (!isNonEmptyString(jump.label)) problem(`${where}: jumpTo.label is required`);
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
        (tree.requiredTools || []).forEach((t, i) => {
            if (!isNonEmptyString(t)) problem(`${name}: requiredTools[${i}] is not a non-empty string`);
        });

        for (const [id, node] of Object.entries(nodes)) {
            const where = `${name}/${id}`;
            // The breadcrumb does hNode.id.replace(...) for every node in the
            // history — one node with a wrong/missing id freezes the screen.
            if (node.id !== id) problem(`${where}: node.id "${node.id}" does not match its key`);
            if (!NODE_TYPES.has(node.type)) problem(`${where}: type "${node.type}" not one of ${[...NODE_TYPES].join('/')}`);
            if (!isNonEmptyString(node.text)) problem(`${where}: missing text`);

            if (node.options !== undefined && !Array.isArray(node.options)) problem(`${where}: options is not an array`);
            const options = Array.isArray(node.options) ? node.options : [];
            options.forEach((o, i) => {
                if (!o || typeof o !== 'object') problem(`${where}: options[${i}] is not an object`);
                else if (!isNonEmptyString(o.label)) problem(`${where}: options[${i}] has an empty label (renders "undefined")`);
            });
            const targets = options.map(o => o && o.next).concat(node.next ? [node.next] : []);
            for (const t of targets) {
                if (!t) problem(`${where}: option with empty next`);
                else if (!nodes[t]) problem(`${where}: broken reference -> "${t}"`);
            }
            // diagnose.html only renders `options`; a bare `next` has no button.
            if (node.next !== undefined) problem(`${where}: uses "next" — the renderer has no button for it; use options`);

            if (node.measurement !== undefined) {
                const m = node.measurement;
                if (!m || typeof m !== 'object') problem(`${where}: measurement is not an object`);
                else for (const k of ['label', 'unit', 'expectedRange']) {
                    if (!isNonEmptyString(m[k])) problem(`${where}: measurement.${k} missing (renders "Expected: undefined")`);
                }
            }
            if (node.checklist !== undefined) {
                if (!Array.isArray(node.checklist)) problem(`${where}: checklist is not an array`);
                else node.checklist.forEach((c, i) => {
                    if (!isNonEmptyString(c)) problem(`${where}: checklist[${i}] is not a non-empty string`);
                });
            }

            if (node.type === 'resolution') {
                if (targets.length) problem(`${where}: resolution should be terminal but has ${targets.length} exit(s)`);
                if (!isNonEmptyString(node.title)) problem(`${where}: resolution missing title`);
                if (!RESOLUTION_SEVERITIES.has(node.severity)) {
                    problem(`${where}: severity "${node.severity}" not one of ${[...RESOLUTION_SEVERITIES].join('/')}`);
                }
                if (node.partsNeeded !== undefined) {
                    if (!Array.isArray(node.partsNeeded)) problem(`${where}: partsNeeded is not an array`);
                    else node.partsNeeded.forEach((p, i) => {
                        if (!isNonEmptyString(p)) problem(`${where}: partsNeeded[${i}] is not a non-empty string`);
                    });
                }
                if (node.jumpTo !== undefined) validateJumpTo(where, node.jumpTo, trees);
            } else {
                if (node.jumpTo !== undefined) problem(`${where}: jumpTo is only rendered on resolution nodes`);
                // Every non-resolution node must lead somewhere, or the tech
                // lands on a screen with only a Back button.
                if (targets.length === 0) problem(`${where}: type "${node.type}" is a dead end (no options/next)`);
                // A single option is a page whose only choice is one button.
                // Nearly every branching node here is type "instruction", so
                // this applies to any node that declares options, not just
                // type "question".
                if (Array.isArray(node.options) && options.length < 2) {
                    problem(`${where}: has options but fewer than 2`);
                }
            }
            walkStrings(node, s => checkUnitPairs(s, where));
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
    const seen = new Map();
    for (const [i, c] of codes.entries()) {
        const where = `faultcode[${i}] ${c.code || '(no code)'}`;
        for (const field of ['code', 'manufacturer', 'severity', 'system', 'description', 'causes', 'steps', 'tools', 'parts']) {
            if (!c[field] || String(c[field]).trim() === '') problem(`${where}: missing/empty "${field}"`);
        }
        if (c.severity && !FAULT_SEVERITIES.has(c.severity)) {
            problem(`${where}: severity "${c.severity}" not one of ${[...FAULT_SEVERITIES].join('/')}`);
        }
        if (c.manufacturer && !MANUFACTURERS.has(c.manufacturer)) {
            problem(`${where}: manufacturer "${c.manufacturer}" not one of ${[...MANUFACTURERS].join('/')}`);
        }
        // The series prefix drives the brand filter and the series label on
        // fault-codes.html: SC* is Mercury SmartCraft, YAM-* (YDS) and
        // YAM-F-* (on-engine flash) are Yamaha. A mismatch lands the card in
        // the wrong brand silently.
        if (isNonEmptyString(c.code)) {
            const expected = /^SC/.test(c.code) ? 'Mercury' : /^YAM-/.test(c.code) ? 'Yamaha' : null;
            if (!expected) problem(`${where}: code prefix is neither SC (Mercury) nor YAM- (Yamaha)`);
            else if (c.manufacturer && expected !== c.manufacturer) {
                problem(`${where}: code prefix says ${expected} but manufacturer is "${c.manufacturer}"`);
            }
        }
        // Pipe-delimited fields: the page does split('|').filter(Boolean), so
        // a stray "|" hides an empty item in the UI but not from the AI corpus.
        for (const field of ['causes', 'steps']) {
            if (!isNonEmptyString(c[field])) continue;
            c[field].split('|').forEach((s, j) => {
                if (!s.trim()) problem(`${where}: ${field} item ${j + 1} is empty (stray "|")`);
            });
        }
        // "Step N:" prefixes are stripped and the <ol> renumbers, so a
        // misnumbered or duplicated step is invisible in the UI but reaches
        // the AI verbatim. When an entry uses prefixes they must run 1..N.
        if (isNonEmptyString(c.steps)) {
            const steps = c.steps.split('|');
            const stepRe = /^\s*Step\s+(\d+)\s*:/i;
            const prefixed = steps.filter(s => stepRe.test(s)).length;
            if (prefixed > 0) {
                if (prefixed !== steps.length) problem(`${where}: ${prefixed} of ${steps.length} steps carry a "Step N:" prefix — use all or none`);
                steps.forEach((s, j) => {
                    const m = stepRe.exec(s);
                    if (m && Number(m[1]) !== j + 1) problem(`${where}: steps[${j}] is labelled "Step ${m[1]}" (expected Step ${j + 1})`);
                });
            }
        }
        const key = `${c.manufacturer}:${c.code}`;
        if (seen.has(key)) problem(`${where}: duplicate code (also at index ${seen.get(key)})`);
        else seen.set(key, i);
        walkStrings(c, s => checkUnitPairs(s, where));
    }
}

function validateSpecs(specs) {
    if (!Array.isArray(specs)) {
        problem('window.engineSpecDatabase is missing or not an array');
        return;
    }
    if (specs.length === 0) problem('engineSpecDatabase is empty');
    // The picker is keyed by array index and shows name + yearsShort, so two
    // entries with the same name are indistinguishable buttons.
    const names = new Map();
    specs.forEach((s, i) => {
        const where = `spec[${i}] ${(s && s.name) || '(no name)'}`;
        if (!s || typeof s !== 'object') { problem(`${where}: not an object`); return; }
        for (const f of SPEC_STRING_FIELDS) {
            if (!isNonEmptyString(s[f])) problem(`${where}: missing/empty "${f}"`);
        }
        if (s.manufacturer && !MANUFACTURERS.has(s.manufacturer)) {
            problem(`${where}: manufacturer "${s.manufacturer}" not one of ${[...MANUFACTURERS].join('/')}`);
        }
        if (s.legacy !== undefined && typeof s.legacy !== 'boolean') problem(`${where}: legacy must be a boolean`);
        if (!Array.isArray(s.notes) || !s.notes.every(isNonEmptyString)) {
            problem(`${where}: notes must be an array of non-empty strings`);
        }
        if (!Array.isArray(s.maintenance)) problem(`${where}: maintenance must be an array`);
        else s.maintenance.forEach((m, j) => {
            // specs.html calls sched.tasks.length — a missing array throws mid-render.
            if (!m || !isNonEmptyString(m.interval) || !Array.isArray(m.tasks) || !m.tasks.every(isNonEmptyString)) {
                problem(`${where}: maintenance[${j}] must be { interval: string, tasks: string[] }`);
            }
        });
        if (isNonEmptyString(s.name)) {
            if (names.has(s.name)) problem(`${where}: duplicate name (also spec[${names.get(s.name)}])`);
            else names.set(s.name, i);
        }
        walkStrings(s, str => checkUnitPairs(str, where));
    });
}

// The factory corpus is the AI's grounding; a pair that disagrees there
// reaches the tech through Ask-a-Tech. Checked line by line for a usable
// location in the report.
function validateManualCorpus(text) {
    if (!isNonEmptyString(text)) {
        problem('window.yamahaManualReference is missing or empty (kb/yamahaManuals.js)');
        return;
    }
    text.split('\n').forEach((line, i) => checkUnitPairs(line, `kb/yamahaManuals.js line ~${i + 1}`));
}

const win = loadDataFiles();
validateTrees(win.defined_trees);
validateMenuCoverage(win.defined_trees);
validateFaultCodes(win.faultCodeDatabase);
validateSpecs(win.engineSpecDatabase);
validateManualCorpus(win.yamahaManualReference);

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
    `${(win.engineSpecDatabase || []).length} engine specs, ` +
    `${unitPairsChecked} unit pairs`);
