// Checks the Tamil data files match the English data shape: same ids, same fields, same array lengths,
// and the same numbers in every string (so doses and the calculator stay correct). Run: node tools/check-ta.mjs
import { readFileSync, existsSync, readdirSync } from 'node:fs';
const root = decodeURIComponent(new URL('..', import.meta.url).pathname);
const load = f => existsSync(root + f) ? readFileSync(root + f, 'utf8') : '';
const more = readdirSync(root).filter(f => /^data-crops-more-\d+\.js$/.test(f)).sort();
const src = ['images.js', 'data-crops.js', ...more, 'data-compost.js', 'data-ta-crops-1.js', 'data-ta-crops-2.js', 'data-ta-compost.js', 'data-dry.js', 'data-ta-dry.js', 'data-water.js', 'data-ta-water.js', 'i18n.js', 'i18n-more.js'].map(load).join('\n')
  .replace(/^const (\w+) =/gm, 'globalThis.$1 =');
globalThis.window = globalThis;
new Function(src)();
const nums = s => (String(s).match(/\d[\d,.]*/g) || []).map(n => n.replace(/,/g, '').replace(/\.$/, '')).sort().join(' ');
const errs = [];
function cmp(en, ta, path) {
  if (ta === undefined) return errs.push(`${path}: missing`);
  if (Array.isArray(en)) {
    if (!Array.isArray(ta) || ta.length !== en.length) return errs.push(`${path}: array length ${ta?.length} ≠ ${en.length}`);
    en.forEach((v, i) => cmp(v, ta[i], `${path}[${i}]`));
  } else if (en && typeof en === 'object') {
    for (const k of Object.keys(ta)) if (!(k in en)) errs.push(`${path}.${k}: extra field`);
    for (const k of Object.keys(en)) if (k in ta) cmp(en[k], ta[k], `${path}.${k}`);
  } else if (typeof en === 'string' && nums(en) !== nums(ta)) errs.push(`${path}: numbers differ  EN[${nums(en)}]  TA[${nums(ta)}]`);
}
const CROP_FIELDS = ['name', 'days', 'soil', 'temp', 'rain', 'spacing', 'seed', 'yield', 'intro', 'steps', 'pests', 'tips', 'companion'];
const INPUT_FIELDS = ['name', 'time', 'effort', 'cost', 'summary', 'nutrients', 'batch', 'dose', 'ingredients', 'steps', 'ready', 'use', 'benefits', 'cautions', 'storage'];
const pick = (o, f) => Object.fromEntries(f.map(k => [k, k === 'batch' || k === 'dose' ? { label: o[k].label } : o[k]]));
const CT = globalThis.CROPS_TA || {}, IT = globalThis.COMPOSTS_TA || {};
for (const c of CROPS) if (CT[c.id]) cmp(pick(c, CROP_FIELDS), CT[c.id], 'crop.' + c.id); else errs.push(`crop.${c.id}: not translated`);
for (const o of COMPOSTS) if (IT[o.id]) cmp(pick(o, INPUT_FIELDS), IT[o.id], 'input.' + o.id); else errs.push(`input.${o.id}: not translated`);
// Drying materials and guide, rain guidance (from Solar Dry House and Water Manager).
const DT = globalThis.DRY_TA || {};
for (const m of globalThis.DRY_MATERIALS || []) if (DT[m.id]) cmp({ prep: m.prep, done: m.done, tip: m.tip }, { prep: DT[m.id].prep, done: DT[m.id].done, tip: DT[m.id].tip }, 'dry.' + m.id); else errs.push(`dry.${m.id}: not translated`);
for (const m of globalThis.DRY_MATERIALS || []) if (DT[m.id] && !!m.tip !== !!DT[m.id].tip) errs.push(`dry.${m.id}.tip: one language is empty`);
if (globalThis.DRY_GUIDE) cmp(globalThis.DRY_GUIDE, globalThis.DRY_GUIDE_TA, 'dryGuide');
const WT = globalThis.WATER_TA || {};
cmp(globalThis.WATER_BEFORE_RAIN, WT.BEFORE_RAIN, 'rain.before');
(globalThis.WATER_METHODS || []).forEach((m, i) => cmp({ title: m.title, best: m.best, cost: m.cost, steps: m.steps, care: m.care }, WT.METHODS?.[i], `rain.method.${m.id}`));
cmp(globalThis.WATER_USES, WT.USES, 'rain.uses');
// Interface text for the new sections: Tamil has every English key (functions are compared by name only).
function keys(en, ta, path) {
  if (ta === undefined) return errs.push(`ui.${path}: missing in Tamil`);
  if (en && typeof en === 'object' && !Array.isArray(en)) for (const k of Object.keys(en)) keys(en[k], ta?.[k], path ? path + '.' + k : k);
}
for (const k of ['tabs', 'titles', 'cropsNav', 'common', 'level', 'section', 'att', 'attDetail', 'act', 'glance', 'w', 'd', 'f', 's']) keys(I18N.en[k], I18N.ta[k], k);
const only = process.argv[2];
const shown = only ? errs.filter(e => e.includes(only)) : errs;
console.log(shown.length ? shown.join('\n') : 'OK: Tamil data matches English shape and numbers' + (only ? ` (${only})` : ''));
