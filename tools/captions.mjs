// Lists every English photo caption that still needs a Tamil version in captions-ta.js.
// Run: node tools/captions.mjs  → prints JSON array of missing captions.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
globalThis.window = globalThis;
const files = ['media.js', 'media-inputs.js', ...readdirSync(root).filter(f => /^media-more-\d+\.js$/.test(f)), 'captions-ta.js'];
new Function(files.filter(f => existsSync(root + f)).map(f => readFileSync(root + f, 'utf8')).join('\n'))();
const caps = new Set();
const add = m => m && m.caption && caps.add(m.caption);
for (const src of [window.MEDIA, window.MEDIA_MORE]) for (const list of Object.values(src?.gallery || {})) list.forEach(add);
for (const list of Object.values(window.MEDIA_INPUTS || {})) list.forEach(add);
const have = window.CAPTIONS_TA || {};
const missing = [...caps].filter(c => !have[c]);
console.log(JSON.stringify(missing, null, 1));
console.error(`${caps.size} captions, ${missing.length} missing Tamil`);
