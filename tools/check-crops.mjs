// Validates every crop (including data-crops-more-*.js batches): fields, month numbers, ids, photo and sources.
// Run: node tools/check-crops.mjs [id-substring]
import { readFileSync, readdirSync } from 'node:fs';
const root = new URL('..', import.meta.url).pathname;
const more = readdirSync(root).filter(f => /^data-crops-more-\d+\.js$/.test(f)).sort();
const files = ['images.js', 'data-crops.js', ...more, 'data-compost.js', 'sources.js'];
const src = files.map(f => readFileSync(root + f, 'utf8')).join('\n').replace(/^const (\w+) =/gm, 'globalThis.$1 =');
globalThis.window = globalThis;
new Function(src)();
const SRC = { ...SOURCES.crops, ...(globalThis.SOURCES_MORE || {}) };
const errs = [], seen = new Set();
const STR = ['name', 'ta', 'sci', 'days', 'soil', 'ph', 'temp', 'rain', 'spacing', 'seed', 'yield', 'intro', 'companion'];
const months = a => Array.isArray(a) && a.every(m => Number.isInteger(m) && m >= 1 && m <= 12);
for (const c of CROPS) {
  const e = m => errs.push(`${c.id}: ${m}`);
  if (seen.has(c.id)) e('duplicate id'); seen.add(c.id);
  for (const k of STR) if (typeof c[k] !== 'string' || !c[k].trim()) e(`missing ${k}`);
  if (!CATEGORIES[c.cat]) e(`bad cat ${c.cat}`);
  if (!Array.isArray(c.seasons) || !c.seasons.length || c.seasons.some(s => !SEASONS[s])) e('bad seasons');
  if (!months(c.sow) || !c.sow.length) e('bad sow months');
  if (!months(c.harvest)) e('bad harvest months');
  if (!['low', 'medium', 'high'].includes(c.water)) e('bad water');
  const st = c.steps || {};
  for (const k of ['prep', 'sow', 'water', 'feed', 'weed', 'harvest']) if (!st[k]) e(`missing steps.${k}`);
  if (Object.keys(st).length !== 6) e('steps must have exactly 6 keys');
  if (!Array.isArray(c.pests) || !c.pests.length || c.pests.some(p => !Array.isArray(p) || p.length !== 2 || !p[0] || !p[1])) e('bad pests');
  if (!Array.isArray(c.tips) || !c.tips.length) e('bad tips');
  if (!Array.isArray(c.compost) || !c.compost.length || c.compost.some(id => !COMPOSTS.find(o => o.id === id))) e('bad compost ids');
  if (!CROP_IMAGES[c.id]?.thumb) e('no photo in CROP_IMAGES');
  if (!SRC[c.id]?.length || SRC[c.id].some(r => !/^https?:\/\//.test(r[1]))) e('no sources');
}
const only = process.argv[2];
const shown = only ? errs.filter(x => x.includes(only)) : errs;
console.log(`${CROPS.length} crops (${more.length} extra batch files)`);
console.log(shown.length ? shown.join('\n') : 'OK: all crops complete');
