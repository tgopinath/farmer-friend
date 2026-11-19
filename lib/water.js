// Water section logic, ported from Water Manager: the daily soil water balance per field (FAO-56,
// single crop coefficient), today's watering advice, pump energy, and rain catchment.
// Pure functions; all wording lives in i18n-more.js so the same numbers show in English and Tamil.
(function (root) {
  // kc: [initial, mid, end]; len: days of [initial, development, mid, late]; zr: max root depth (m);
  // p: share of available water the crop can use before it stresses; drip: canopy share wetted under drip.
  // ff: the matching crop guide in the Crops section, when there is one.
  const CROPS = {
    paddy:     { kc: [1.05, 1.2, 0.9],  len: [30, 30, 60, 30],   zr: 0.3, p: 0.2, perc: 3, ff: 'rice' },
    wheat:     { kc: [0.4, 1.15, 0.4],  len: [30, 40, 40, 30],   zr: 1.2, p: 0.55, ff: 'wheat' },
    maize:     { kc: [0.3, 1.2, 0.6],   len: [25, 40, 45, 30],   zr: 1.0, p: 0.55, ff: 'maize' },
    sorghum:   { kc: [0.3, 1.0, 0.55],  len: [20, 35, 40, 30],   zr: 1.0, p: 0.55, ff: 'sorghum' },
    ragi:      { kc: [0.3, 1.0, 0.3],   len: [15, 25, 40, 25],   zr: 1.0, p: 0.55, ff: 'ragi' },
    pulses:    { kc: [0.4, 1.05, 0.35], len: [15, 25, 25, 10],   zr: 0.7, p: 0.45, ff: 'moong' },
    groundnut: { kc: [0.4, 1.15, 0.6],  len: [25, 35, 45, 25],   zr: 0.6, p: 0.5, ff: 'groundnut' },
    cotton:    { kc: [0.35, 1.15, 0.6], len: [30, 50, 55, 45],   zr: 1.2, p: 0.65, ff: 'cotton' },
    sugarcane: { kc: [0.4, 1.25, 0.75], len: [35, 60, 190, 120], zr: 1.5, p: 0.65, drip: 1, ff: 'sugarcane' },
    banana:    { kc: [0.5, 1.1, 1.0],   len: [120, 90, 120, 60], zr: 0.8, p: 0.35, drip: 0.75, ff: 'banana' },
    tomato:    { kc: [0.6, 1.15, 0.8],  len: [30, 40, 45, 30],   zr: 1.0, p: 0.4, ff: 'tomato' },
    onion:     { kc: [0.7, 1.05, 0.75], len: [15, 25, 70, 40],   zr: 0.4, p: 0.3, ff: 'onion' },
    chilli:    { kc: [0.6, 1.05, 0.9],  len: [30, 35, 40, 20],   zr: 0.7, p: 0.3, ff: 'chilli' },
    brinjal:   { kc: [0.6, 1.05, 0.9],  len: [30, 40, 40, 20],   zr: 0.9, p: 0.45, ff: 'brinjal' },
    greens:    { kc: [0.7, 1.0, 0.9],   len: [20, 30, 30, 15],   zr: 0.4, p: 0.4, ff: 'amaranth' },
    turmeric:  { kc: [0.5, 1.05, 0.75], len: [30, 60, 120, 60],  zr: 0.5, p: 0.5, ff: 'turmeric' },
    coconut:   { kc: 1.0, zr: 1.0, p: 0.65, drip: 0.3, ff: 'coconut' },
    mango:     { kc: 0.85, zr: 1.5, p: 0.6, drip: 0.35, ff: 'mango' },
    fodder:    { kc: 0.95, zr: 1.0, p: 0.55 },
  };
  // Available water held per metre of root depth (mm/m).
  const SOILS = { sandy: { taw: 70 }, red: { taw: 120 }, loam: { taw: 150 }, black: { taw: 190 } };
  const METHODS = { drip: { eff: 0.9 }, sprinkler: { eff: 0.75 }, furrow: { eff: 0.6 }, flood: { eff: 0.55 } };
  const SOURCE_KINDS = ['borewell', 'openwell', 'tank', 'pond', 'canal'];
  // Runoff share for each catchment surface.
  const SURFACES = { concrete: 0.85, sheet: 0.8, tile: 0.75, paved: 0.7, bare: 0.3, field: 0.15 };
  const M2_PER_ACRE = 4046.86, SQFT_PER_M2 = 10.7639;
  const DAY = 86400000;
  const iso = d => d.toISOString().slice(0, 10);
  const addDays = (s, n) => iso(new Date(new Date(s + 'T00:00Z').getTime() + n * DAY));
  const daysBetween = (a, b) => Math.round((new Date(b + 'T00:00Z') - new Date(a + 'T00:00Z')) / DAY);

  // Stage keys: notsown, initial, growing, mid, late, ready, established.
  function stage(crop, dap) {
    if (!Array.isArray(crop.kc)) return { key: 'established', kc: crop.kc, frac: 1, done: false };
    const [i, d, m, l] = crop.len, [ki, km, ke] = crop.kc;
    if (dap < 0) return { key: 'notsown', kc: 0, frac: 0, done: false };
    if (dap < i) return { key: 'initial', kc: ki, frac: dap / (i + d), done: false };
    if (dap < i + d) return { key: 'growing', kc: ki + (km - ki) * ((dap - i) / d), frac: dap / (i + d), done: false };
    if (dap < i + d + m) return { key: 'mid', kc: km, frac: 1, done: false };
    if (dap < i + d + m + l) return { key: 'late', kc: km + (ke - km) * ((dap - i - d - m) / l), frac: 1, done: false };
    return { key: 'ready', kc: ke, frac: 1, done: true };
  }
  const seasonLength = crop => (Array.isArray(crop.len) ? crop.len.reduce((a, b) => a + b, 0) : null);

  // Forecast rain is weighted by its chance; past rain counts in full.
  const expectedRain = day => (day.past || day.prob == null ? day.rain : day.rain * Math.min(1, day.prob / 100 + 0.15));
  const effRain = mm => (mm < 3 ? 0 : mm * 0.8);

  // What one field needs on one day, in mm over the whole field.
  function dayNeed(field, day) {
    const crop = CROPS[field.crop];
    const dap = field.sown ? daysBetween(field.sown, day.date) : 999;
    const st = stage(crop, dap);
    const cover = field.method === 'drip' ? (crop.drip ?? 0.85) : 1;
    const zr = Array.isArray(crop.kc) ? 0.15 + (crop.zr - 0.15) * Math.min(1, st.frac) : crop.zr;
    const taw = Math.max(15, SOILS[field.soil].taw * zr * cover);
    // Drip is meant to top up little and often, so it waits for a much smaller dip than flood or furrow.
    const p = field.method === 'drip' ? Math.min(crop.p, 0.15) : crop.p;
    return { st, dap, etc: day.et0 * st.kc * cover + (crop.perc || 0), taw, raw: taw * p };
  }

  // Walk the days for one field. Depletion (mm below full) starts at 0 on sowing or 30 days ago,
  // rises with crop use and falls with rain and watering. A soil check resets it.
  function balance(field, weatherDays, logs) {
    const area = field.acres * M2_PER_ACRE, eff = METHODS[field.method].eff;
    const mine = logs.filter(l => l.fieldId === field.id);
    let dr = 0;
    const rows = [];
    for (const day of weatherDays) {
      if (field.sown && day.date < field.sown) continue;
      const n = dayNeed(field, day);
      const rain = effRain(expectedRain(day));
      const applied = mine.filter(l => l.type === 'water' && l.date === day.date).reduce((s, l) => s + (l.litres / area) * eff, 0);
      const check = mine.filter(l => l.type === 'check' && l.date === day.date).pop();
      dr = Math.min(n.taw, Math.max(0, dr + n.etc - rain - applied));
      if (check) dr = n.taw * check.level;
      rows.push({ date: day.date, past: day.past, today: day.today, etc: n.etc, rain, applied, dr, taw: n.taw, raw: n.raw, stage: n.st, dap: n.dap,
        left: 1 - dr / n.taw, rawLeft: 1 - n.raw / n.taw });
    }
    return { rows, area, eff };
  }

  // Today's advice for a field: key is urgent | water | hold | ok | wait | done.
  function advise(field, weatherDays, logs, source) {
    const { rows, area, eff } = balance(field, weatherDays, logs);
    const i = rows.findIndex(r => r.today);
    if (i < 0) return { key: 'wait', rows, sown: field.sown || '' };
    const t = rows[i];
    if (t.stage.done) return { key: 'done', rows, t };
    const giveMm = t.dr / eff, litres = giveMm * area;
    const flow = (source && source.flowLpm) || 0;
    const amount = { mm: giveMm, litres, minutes: flow ? litres / flow : null };
    const rainSoon = rows.slice(i + 1, i + 3).reduce((s, r) => s + r.rain, 0);
    if (t.dr >= t.raw) {
      if (rainSoon >= t.dr * 0.6) return { key: 'hold', rows, t, amount, rainSoon };
      return { key: t.dr >= t.taw * 0.85 ? 'urgent' : 'water', rows, t, amount };
    }
    let next = null;
    for (const r of rows.slice(i + 1)) if (r.dr >= r.raw) { next = r.date; break; }
    return { key: 'ok', rows, t, amount, next };
  }

  const pumpKwh = (source, minutes) => (source && source.hp ? source.hp * 0.746 * (minutes / 60) : 0);
  // litres = area (m²) × rain (mm) × runoff share
  const catchLitres = (catchments, mm) => catchments.reduce((s, c) => s + c.m2 * mm * (SURFACES[c.surface] ?? 0.5), 0);
  function rainOutlook(weatherDays) {
    const ahead = weatherDays.filter(d => !d.past).slice(0, 14), past = weatherDays.filter(d => d.past);
    return {
      next7: ahead.slice(0, 7).reduce((s, d) => s + expectedRain(d), 0),
      next14: ahead.reduce((s, d) => s + expectedRain(d), 0),
      last30: past.reduce((s, d) => s + d.rain, 0),
      big: ahead.filter(d => d.rain >= 10 && (d.prob ?? 100) >= 40),
      ahead,
    };
  }

  root.FFWater = { CROPS, SOILS, METHODS, SOURCE_KINDS, SURFACES, M2_PER_ACRE, SQFT_PER_M2, addDays, daysBetween,
    stage, seasonLength, expectedRain, balance, advise, pumpKwh, catchLitres, rainOutlook };
})(typeof self !== 'undefined' ? self : globalThis);
