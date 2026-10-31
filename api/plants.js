// GET  /api/plants          → plants added by the admin (public, used by the app)
// POST /api/plants          → { action: 'login' } | { action: 'save', plant } | { action: 'delete', id }  (admin only)
import { readPlants, writePlants, isAdmin, json } from './_store.js';

const ID = /^[a-z0-9][a-z0-9-]{1,40}$/;
const RESERVED = new Set(['admin', 'api', 'new']);
const months = a => Array.isArray(a) && a.every(m => Number.isInteger(m) && m >= 1 && m <= 12);
const str = (v, max = 2000) => typeof v === 'string' ? v.trim().slice(0, max) : '';

// Keeps only known fields, trimmed, so the stored file always has the app's crop shape.
function clean(p) {
  const steps = {};
  for (const k of ['prep', 'sow', 'water', 'feed', 'weed', 'harvest']) steps[k] = str(p.steps?.[k]);
  const pairs = a => (Array.isArray(a) ? a : []).map(x => [str(x?.[0], 120), str(x?.[1], 600)]).filter(x => x[0]).slice(0, 12);
  const list = (a, n = 12, max = 400) => (Array.isArray(a) ? a : []).map(x => str(x, max)).filter(Boolean).slice(0, n);
  const out = {
    id: str(p.id, 41).toLowerCase(), name: str(p.name, 80), ta: str(p.ta, 80), sci: str(p.sci, 80), cat: str(p.cat, 20),
    seasons: (Array.isArray(p.seasons) ? p.seasons : []).filter(s => ['kharif', 'rabi', 'zaid'].includes(s)),
    sow: months(p.sow) ? p.sow : [], harvest: months(p.harvest) ? p.harvest : [],
    days: str(p.days, 80), soil: str(p.soil, 200), ph: str(p.ph, 40), temp: str(p.temp, 80),
    water: ['low', 'medium', 'high'].includes(p.water) ? p.water : 'medium', rain: str(p.rain, 120),
    spacing: str(p.spacing, 160), seed: str(p.seed, 200), yield: str(p.yield, 160), intro: str(p.intro, 800),
    steps, pests: pairs(p.pests), tips: list(p.tips), companion: str(p.companion, 400),
    compost: list(p.compost, 10, 40),
    image: p.image && /^https:\/\//.test(p.image.src || '') ? { src: str(p.image.src, 600), thumb: str(p.image.thumb || p.image.src, 600), credit: str(p.image.credit, 200) } : null,
    sources: pairs(p.sources).filter(([, u]) => /^https?:\/\//.test(u)),
    taText: null, updated: new Date().toISOString(),
  };
  if (p.taText && typeof p.taText === 'object') {
    const t = p.taText, ts = {};
    for (const k of ['prep', 'sow', 'water', 'feed', 'weed', 'harvest']) ts[k] = str(t.steps?.[k]);
    out.taText = { name: str(t.name, 80), intro: str(t.intro, 800), days: str(t.days, 80), soil: str(t.soil, 200), temp: str(t.temp, 80), rain: str(t.rain, 120),
      spacing: str(t.spacing, 160), seed: str(t.seed, 200), yield: str(t.yield, 160), companion: str(t.companion, 400), steps: ts, pests: pairs(t.pests), tips: list(t.tips) };
  }
  return out;
}

export async function GET() {
  try { return json(await readPlants(), 200, { 'cache-control': 'public, max-age=0, s-maxage=30, stale-while-revalidate=300', 'access-control-allow-origin': '*' }); }
  catch (e) { return json({ error: 'Could not read plants' }, 500); }
}

export async function POST(req) {
  if (!(await isAdmin(req))) return json({ error: 'Wrong username or password' }, 401);
  let body; try { body = await req.json(); } catch { return json({ error: 'Bad request' }, 400); }
  if (body.action === 'login') return json({ ok: true });
  const plants = await readPlants();
  if (body.action === 'delete') {
    const next = plants.filter(p => p.id !== body.id);
    await writePlants(next);
    return json({ ok: true, count: next.length });
  }
  if (body.action === 'save') {
    const p = clean(body.plant || {});
    const missing = ['id', 'name', 'cat', 'intro'].filter(k => !p[k]);
    if (missing.length) return json({ error: `Missing: ${missing.join(', ')}` }, 400);
    if (!ID.test(p.id) || RESERVED.has(p.id)) return json({ error: 'Id must be lowercase letters, numbers and dashes' }, 400);
    if (body.builtIn && body.builtIn.includes(p.id) && !plants.some(x => x.id === p.id)) return json({ error: 'That id is already used by a built-in crop' }, 409);
    if (!p.sow.length) return json({ error: 'Pick at least one sowing month' }, 400);
    if (!p.seasons.length) return json({ error: 'Pick at least one season' }, 400);
    const i = plants.findIndex(x => x.id === p.id);
    if (i >= 0) plants[i] = p; else plants.push(p);
    await writePlants(plants);
    return json({ ok: true, plant: p });
  }
  return json({ error: 'Unknown action' }, 400);
}
