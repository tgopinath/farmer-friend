// Water section (from Water Manager): today's watering per field, field detail with the soil water chart,
// rain and borewell recharge, and water use. Logic in lib/water.js; text in i18n-more.js (L.w).
const W = FFWater;
const wField = id => farm.find('fields', id);
const wSource = id => farm.find('sources', id);
const WSTATUS = { urgent: ['crit', 'alert'], water: ['warn', 'drop'], hold: ['info', 'rain'], ok: ['good', 'check'], done: ['muted', 'check'], wait: ['muted', 'clock'] };
const wPill = a => `<span class="wpill ${WSTATUS[a.key][0]}">${icon(WSTATUS[a.key][1])}${esc(L.w.status[a.key])}</span>`;
const cropName = k => L.w.crops[k] || k;
const wNav = on => subnav([['today', '#/water', L.w.nav.today], ['fields', '#/water/fields', L.w.nav.fields], ['rain', '#/water/rain', L.w.nav.rain], ['use', '#/water/use', L.w.nav.use]], on, L.titles.water);
function wDetail(a) {
  if (!a) return '';
  if (a.key === 'hold') return L.w.holdDetail(Math.round(a.rainSoon));
  if (a.key === 'ok') return a.next ? L.w.okNext(dayName(a.next, true)) : L.w.okNone;
  if (a.key === 'done') return L.w.doneDetail;
  if (a.key === 'wait') return L.w.waitDetail(a.sown ? dayName(a.sown, true) : '');
  return '';
}
// Advice for every field, most urgent first.
function waterAdvice(wd) {
  const order = { urgent: 0, water: 1, hold: 2, ok: 3, wait: 4, done: 5 };
  return farm.list('fields').map(f => ({ field: f, advice: wd.length ? W.advise(f, wd, farm.list('logs'), wSource(f.sourceId)) : null }))
    .sort((x, y) => (order[x.advice?.key] ?? 9) - (order[y.advice?.key] ?? 9));
}

/* ---------- Watering today ---------- */
let pumpTick = null;
function viewWater() { return `<div class="fade-in" id="waterPage"></div>`; }
function bindWater() {
  withWeather((w, failed) => {
    const el = $('#waterPage'); if (!el) return;
    const wd = wxDays.water(w), ahead = wd.filter(d => !d.past).slice(0, 7), out = W.rainOutlook(wd);
    const adv = waterAdvice(wd), due = adv.filter(x => x.advice && (x.advice.key === 'water' || x.advice.key === 'urgent'));
    const dueL = due.reduce((s, x) => s + x.advice.amount.litres, 0), now = w?.d.current;
    const rech = farm.list('catchments').filter(c => c.to === 'recharge');
    el.innerHTML = `
      <span class="eyebrow">${esc(L.w.eyebrow)}</span>
      <h1 class="page-title">${esc(!wd.length ? (failed ? L.wxFail : L.w.fetching) : L.w.title(due.length))}</h1>
      <p class="page-lede">${due.length ? esc(L.w.lede(litres(dueL))) : wd.length ? esc(L.w.enough) : ''} ${now ? esc(L.w.now(Math.round(now.temperature_2m), now.relative_humidity_2m)) : ''}</p>
      ${wNav('today')}${sampleNote()}
      ${runningBanner()}
      ${out.big.length ? `<a class="card rain-alert" href="#/water/rain">${icon('rain')}<div><b>${esc(L.w.rainAlert(relDay(out.big[0].date, true), Math.round(out.big[0].rain)))}</b>
        <span>${esc(L.w.rainAlertSub)}${farm.list('catchments').length ? ` · ${esc(L.w.rainAlertCatch(litres(W.catchLitres(rech, out.big[0].rain))))}` : ''}. ${esc(L.w.seeWhat)}</span></div>${icon('next')}</a>` : ''}
      ${ahead.length ? `<section class="section"><div class="section-head"><div><h2>${esc(L.w.next7)}</h2><p>${esc(L.w.next7Sub)}</p></div></div>${wStrip(ahead)}</section>` : ''}
      <section class="section"><div class="section-head"><div><h2>${esc(L.w.fieldsTitle)}</h2><p>${esc(L.w.fieldsLede)}</p></div>
        <button type="button" class="btn btn-outline" data-w="add-field">${icon('plus')}${esc(L.w.addField)}</button></div>
        ${adv.length ? `<div class="wcards">${adv.map(({ field, advice }) => fieldCard(field, advice)).join('')}</div>` : `<div class="card empty-card"><p>${esc(L.w.noFields)}</p><button class="btn btn-primary" data-w="add-field">${esc(L.w.addField)}</button></div>`}
      </section>
      <p class="muted fine">${esc(L.w.method)}</p>`;
    updateRunning();
  });
  clearInterval(pumpTick);
  if (farm.data.running) pumpTick = setInterval(updateRunning, 1000);
}
function wStrip(list) {
  return `<ol class="wstrip" aria-label="${esc(L.w.next7)}">${list.map(d => { const c = FFWx.code(d.code);
    return `<li class="${d.today ? 'is-today' : ''}"><span class="d">${esc(d.today ? L.common.today : dayName(d.date))}</span>${icon(c.icon)}<span class="t">${Math.round(d.tmax)}°</span>
      <span class="r ${d.rain >= 10 ? 'big' : ''}">${d.rain >= 0.5 ? `${nf(d.rain, d.rain < 10 ? 1 : 0)} mm` : esc(L.w.dry)}</span><span class="e">${esc(L.w.et)} ${nf(d.et0, 1)}</span></li>`; }).join('')}</ol>`;
}
function gauge(left, rawLeft) {
  const pct = Math.round(Math.max(0, Math.min(1, left)) * 100), line = Math.round(rawLeft * 100);
  return `<div class="gauge" role="img" aria-label="${esc(L.w.tipSoil(pct))}"><div class="fill" style="height:${pct}%"></div><div class="line" style="bottom:${line}%"></div><span>${pct}%</span></div>`;
}
function fieldCard(f, a) {
  const s = wSource(f.sourceId), t = a?.t, busy = farm.data.running?.fieldId === f.id;
  const needs = a && ['water', 'urgent', 'hold'].includes(a.key), detail = wDetail(a);
  return `<article class="card wcard ${a ? WSTATUS[a.key][0] : ''}">
    ${t ? gauge(t.left, t.rawLeft) : `<div class="gauge empty"></div>`}
    <div class="wcard-body">
      <span class="eyebrow">${esc(cropName(f.crop))} · ${nf(f.acres, 2)} ${LANG === 'ta' ? 'ஏக்.' : 'ac'} · ${esc(L.w.methods[f.method])}</span>
      <h3><a href="#/water/field/${f.id}">${esc(dn(f.name))}</a></h3>
      ${a ? wPill(a) : ''}
      ${needs && a.amount ? `<p class="amount"><b>${litres(a.amount.litres)}</b> · ${nf(a.amount.mm, 1)} mm${a.amount.minutes && s ? ` · <b>${dur(a.amount.minutes)}</b> ${esc(L.w.on(dn(s.name)))}` : ''}</p>` : ''}
      ${detail ? `<p class="detail">${esc(detail)}</p>` : ''}
      <div class="row-btns">
        ${busy ? `<button class="btn btn-primary sm" data-w="stop">${esc(L.w.stopPump)}</button>` : s && a?.key !== 'done' ? `<button class="btn ${a?.key === 'water' || a?.key === 'urgent' ? 'btn-primary' : 'btn-outline'} sm" data-w="pump" data-id="${f.id}" ${farm.data.running ? 'disabled' : ''}>${icon('play')}${esc(L.w.startPump)}</button>` : ''}
        <button class="btn btn-outline sm" data-w="log" data-id="${f.id}">${esc(L.w.logWatering)}</button>
        <button class="btn btn-ghost sm" data-w="check" data-id="${f.id}">${esc(L.w.soilCheck)}</button>
      </div>
    </div></article>`;
}
function runningBanner() {
  const r = farm.data.running; if (!r) return '';
  const f = wField(r.fieldId), s = wSource(r.sourceId);
  return `<section class="card running" aria-live="polite"><div class="ripple" aria-hidden="true"></div>
    <div><span class="eyebrow">${esc(L.w.running(dn(s?.name || '')))}</span><h2>${esc(dn(f?.name || ''))}</h2><p class="mono" id="runStats"></p><div class="bar"><span id="runBar"></span></div></div>
    <button class="btn btn-primary" data-w="stop">${esc(L.w.stopLog)}</button></section>`;
}
function updateRunning() {
  const r = farm.data.running, el = document.getElementById('runStats');
  if (!r || !el) return;
  const s = wSource(r.sourceId), min = (Date.now() - r.start) / 60000, l = min * (s?.flowLpm || 0), secs = Math.floor((Date.now() - r.start) / 1000);
  const clock = `${Math.floor(secs / 3600)}:${String(Math.floor(secs / 60) % 60).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;
  el.textContent = `${clock} · ${r.target ? L.w.of(litres(l), litres(r.target)) : litres(l)}`;
  const bar = document.getElementById('runBar'); if (bar) bar.style.width = r.target ? `${Math.min(100, (l / r.target) * 100)}%` : '100%';
}

/* ---------- Fields and sources ---------- */
function viewWaterFields() {
  const fields = farm.list('fields'), sources = farm.list('sources');
  return `<div class="fade-in">
    <span class="eyebrow">${esc(L.w.eyebrow)}</span><h1 class="page-title">${esc(L.w.fieldsTitle)}</h1><p class="page-lede">${esc(L.w.fieldsLede)}</p>
    ${wNav('fields')}
    <div class="list-head"><button class="btn btn-primary" data-w="add-field">${icon('plus')}${esc(L.w.addField)}</button></div>
    ${fields.length ? `<ul class="card rows">${fields.map(f => {
      const crop = W.CROPS[f.crop], dap = f.sown ? W.daysBetween(f.sown, todayISO()) : null, st = W.stage(crop, dap ?? 999);
      return `<li><a href="#/water/field/${f.id}"><div><b>${esc(dn(f.name))}</b><small>${esc(cropName(f.crop))} · ${nf(f.acres, 2)} ${LANG === 'ta' ? 'ஏக்கர்' : 'acres'} · ${esc(L.w.soils[f.soil])} · ${esc(L.w.methods[f.method])}</small></div>
        <span class="meta">${esc(dap != null ? (dap < 0 ? L.w.sowingIn(-dap) : L.w.dayOf(dap, L.w.stage[st.key])) : L.w.stage[st.key])}</span>${icon('next')}</a></li>`; }).join('')}</ul>` : `<p class="empty">${esc(L.w.addFirst)}</p>`}
    <section class="section"><div class="section-head"><div><h2>${esc(L.w.sourcesTitle)}</h2></div><button class="btn btn-outline" data-w="add-source">${icon('plus')}${esc(L.w.addSource)}</button></div>
      <ul class="card rows">${sources.map(s => `<li><button type="button" data-w="edit-source" data-id="${s.id}"><div><b>${esc(dn(s.name))}</b>
        <small>${esc(L.w.kinds[s.kind])} · ${esc(L.w.flow(nf(s.flowLpm)))}${s.hp ? ` · ${esc(L.w.hp(s.hp))}` : ''}${s.capacityL ? ` · ${esc(L.w.holds(litres(s.capacityL)))}` : ''}</small></div><span class="meta">${esc(L.common.edit)}</span></button></li>`).join('') || `<li class="empty">${esc(L.common.none)}</li>`}</ul>
    </section>
  </div>`;
}

function viewWaterField(id) {
  const f = wField(id); if (!f) return notFound();
  return `<div class="fade-in" id="wfPage" data-id="${esc(id)}"></div>`;
}
function bindWaterField(id) {
  withWeather(w => {
    const el = $('#wfPage'), f = wField(id); if (!el || !f) return;
    const wd = wxDays.water(w), crop = W.CROPS[f.crop], s = wSource(f.sourceId);
    const a = wd.length ? W.advise(f, wd, farm.list('logs'), s) : null;
    const logs = farm.list('logs').filter(l => l.fieldId === f.id).sort((x, y) => y.date.localeCompare(x.date));
    const dap = f.sown ? W.daysBetween(f.sown, todayISO()) : null, st = W.stage(crop, dap ?? 999), len = W.seasonLength(crop);
    const guide = crop.ff && cropById(crop.ff);
    el.innerHTML = `<a class="back" href="#/water">${icon('back')}${esc(L.w.nav.today)}</a>
      <span class="eyebrow">${esc(cropName(f.crop))} · ${nf(f.acres, 2)} ${LANG === 'ta' ? 'ஏக்கர்' : 'acres'} · ${esc(L.w.soils[f.soil])}</span>
      <div class="title-row"><h1 class="page-title">${esc(dn(f.name))}</h1><button class="btn btn-outline sm" data-w="edit-field" data-id="${f.id}">${esc(L.common.edit)}</button></div>
      ${a ? wPill(a) : ''}
      ${runningBanner()}
      <div class="facts">
        <div class="fact"><small>${esc(L.w.facts.stage)}</small><b>${esc(L.w.stage[st.key])}</b><span class="sub">${esc(dap != null && len ? L.w.dayOfLen(Math.max(0, dap), len) : L.w.perennial)}</span></div>
        <div class="fact"><small>${esc(L.w.facts.kc)}</small><b>${nf(st.kc, 2)}</b><span class="sub">${esc(L.w.facts.kcSub)}</span></div>
        <div class="fact"><small>${esc(L.w.facts.soil)}</small><b>${a?.t ? Math.round(a.t.left * 100) + '%' : '—'}</b><span class="sub">${a?.t ? esc(L.w.mmOf(nf(a.t.taw - a.t.dr), nf(a.t.taw))) : ''}</span></div>
        <div class="fact"><small>${esc(L.w.facts.fill)}</small><b>${a?.amount ? litres(a.amount.litres) : '—'}</b><span class="sub">${a?.amount?.minutes && s ? esc(`${dur(a.amount.minutes)} ${L.w.on(dn(s.name))}`) : ''}</span></div>
      </div>
      ${wDetail(a) ? `<p class="detail">${esc(wDetail(a))}</p>` : ''}
      ${L.w.cropNote[f.crop] ? `<p class="muted fine">${esc(L.w.cropNote[f.crop])}</p>` : ''}
      <div class="row-btns">
        ${farm.data.running?.fieldId === f.id ? `<button class="btn btn-primary" data-w="stop">${esc(L.w.stopPump)}</button>` : s ? `<button class="btn btn-primary" data-w="pump" data-id="${f.id}" ${farm.data.running ? 'disabled' : ''}>${icon('play')}${esc(L.w.startPump)}</button>` : ''}
        <button class="btn btn-outline" data-w="log" data-id="${f.id}">${esc(L.w.logWatering)}</button>
        <button class="btn btn-outline" data-w="check" data-id="${f.id}">${esc(L.w.soilCheck)}</button>
        ${guide ? `<a class="btn btn-ghost" href="#/crop/${guide.id}">${icon('leaf')}${esc(L.w.guide)}: ${esc(guide.name)}</a>` : ''}
      </div>
      ${a?.rows?.length ? `<section class="section"><div class="section-head"><div><h2>${esc(L.w.chartTitle)}</h2><p>${esc(L.w.chartSub)}</p></div></div><div class="card chart-card">${soilChart(a.rows)}</div></section>` : ''}
      <section class="section"><div class="section-head"><div><h2>${esc(L.w.history)}</h2></div></div>
        ${logs.length ? `<ul class="card rows">${logs.slice(0, 40).map(logRow).join('')}</ul>` : `<p class="empty">${esc(L.w.nothingLogged)}</p>`}</section>`;
    bindChart();
    updateRunning();
  });
  clearInterval(pumpTick);
  if (farm.data.running) pumpTick = setInterval(updateRunning, 1000);
}
function logRow(l) {
  const f = wField(l.fieldId), s = wSource(l.sourceId);
  const word = l.level <= 0.1 ? L.w.check.wet : l.level <= 0.5 ? L.w.check.moist : L.w.check.dry;
  const what = l.type === 'check' ? L.w.checkRow(word) : `${litres(l.litres)}${l.minutes ? ` · ${dur(l.minutes)}` : ''}${s ? ` · ${dn(s.name)}` : ''}`;
  return `<li><div><b>${esc(shortDate(l.date))} · ${esc(dn(f?.name || ''))}</b><small>${esc(what)}${l.note ? ` · ${esc(l.note)}` : ''}</small></div>
    <button type="button" class="icon-btn" data-w="del-log" data-id="${l.id}" aria-label="${esc(L.common.del)}">${icon('x')}</button></li>`;
}

// Soil water as a share of what roots can use; the dashed line marks where to water.
function soilChart(rows) {
  const Wd = 760, H = 220, P = { l: 40, r: 12, t: 12, b: 24 }, RH = 60;
  const x = i => P.l + (i / Math.max(1, rows.length - 1)) * (Wd - P.l - P.r);
  const lo = Math.max(0, Math.floor((Math.min(...rows.map(r => Math.min(r.left, r.rawLeft))) - 0.1) * 10) / 10);
  const y = v => P.t + ((1 - v) / (1 - lo)) * (H - P.t - P.b);
  const ti = rows.findIndex(r => r.today);
  const path = (rs, off) => rs.map((r, i) => `${i ? 'L' : 'M'}${x(i + off).toFixed(1)},${y(Math.max(lo, r.left)).toFixed(1)}`).join('');
  const past = rows.slice(0, ti + 1), fut = rows.slice(Math.max(0, ti));
  const thr = rows.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r.rawLeft).toFixed(1)}`).join('');
  const maxIn = Math.max(10, ...rows.map(r => r.rain + r.applied)), bw = Math.max(3, (Wd - P.l - P.r) / rows.length - 3), ry = v => (v / maxIn) * (RH - 16);
  const ticks = rows.map((r, i) => ({ r, i })).filter(({ i }) => i % 7 === ((ti % 7) + 7) % 7);
  return `<figure class="soil-chart" data-lo="${lo}" data-rows='${esc(JSON.stringify(rows.map(r => ({ d: r.date, l: r.left, rain: r.rain, w: r.applied }))))}'>
    <svg viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${esc(L.w.chartAria)}">
      ${[lo, (lo + 1) / 2, 1].map(v => `<line class="grid" x1="${P.l}" x2="${Wd - P.r}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${P.l - 6}" y="${y(v) + 4}" text-anchor="end">${Math.round(v * 100)}%</text>`).join('')}
      <path class="zone" d="${thr}L${x(rows.length - 1)},${y(lo)}L${x(0)},${y(lo)}Z"/><path class="thr" d="${thr}"/>
      ${ti >= 0 ? `<line class="now" x1="${x(ti)}" x2="${x(ti)}" y1="${P.t}" y2="${H - P.b}"/><text class="ax" x="${x(ti) + 4}" y="${P.t + 10}">${esc(L.w.today)}</text>` : ''}
      <path class="ln" d="${path(past, 0)}"/><path class="ln fut" d="${path(fut, Math.max(0, ti))}"/>
      ${ticks.map(({ r, i }) => `<text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="middle">${esc(shortDate(r.date))}</text>`).join('')}
      <text class="ax zone-label" x="${Wd - P.r - 4}" y="${y(lo) - 6}" text-anchor="end">${esc(L.w.chartZone)}</text>
      <g class="hover" visibility="hidden"><circle class="dot" r="5"/><line class="cross" y1="${P.t}" y2="${H - P.b}"/></g>
    </svg>
    <svg viewBox="0 0 ${Wd} ${RH}" class="bars" aria-hidden="true">
      ${rows.map((r, i) => { const hr = ry(r.rain), hw = ry(r.applied), cx = x(i) - bw / 2, base = RH - 4;
        return `${hr ? `<rect class="b-rain" x="${cx}" y="${base - hr}" width="${bw}" height="${hr}" rx="2"/>` : ''}${hw ? `<rect class="b-water" x="${cx}" y="${base - hr - hw - (hr ? 2 : 0)}" width="${bw}" height="${hw}" rx="2"/>` : ''}`; }).join('')}
      <line class="grid" x1="${P.l}" x2="${Wd - P.r}" y1="${RH - 4}" y2="${RH - 4}"/>
    </svg>
    <figcaption class="legend"><span><i class="k-ln"></i>${esc(L.w.lg.soil)}</span><span><i class="k-thr"></i>${esc(L.w.lg.thr)}</span><span><i class="k-rain"></i>${esc(L.w.lg.rain)}</span><span><i class="k-water"></i>${esc(L.w.lg.water)}</span></figcaption>
    <div class="tip" hidden></div></figure>`;
}
function bindChart() {
  const fig = app.querySelector('.soil-chart'); if (!fig) return;
  const rows = JSON.parse(fig.dataset.rows), svg = fig.querySelector('svg'), tip = fig.querySelector('.tip');
  const dot = svg.querySelector('.dot'), cross = svg.querySelector('.cross'), hov = svg.querySelector('.hover');
  const Wd = 760, l = 40, r = 12, H = 220, lo = Number(fig.dataset.lo);
  svg.addEventListener('pointermove', ev => {
    const b = svg.getBoundingClientRect(), px = ((ev.clientX - b.left) / b.width) * Wd;
    const i = Math.max(0, Math.min(rows.length - 1, Math.round(((px - l) / (Wd - l - r)) * (rows.length - 1)))), d = rows[i];
    const cx = l + (i / Math.max(1, rows.length - 1)) * (Wd - l - r), cy = 12 + ((1 - Math.max(lo, d.l)) / (1 - lo)) * (H - 36);
    dot.setAttribute('cx', cx); dot.setAttribute('cy', cy); cross.setAttribute('x1', cx); cross.setAttribute('x2', cx);
    tip.hidden = false; hov.setAttribute('visibility', 'visible');
    tip.innerHTML = `<b>${esc(shortDate(d.d))}${d.d > todayISO() ? ' ' + esc(L.w.forecast) : ''}</b><span>${esc(L.w.tipSoil(Math.round(d.l * 100)))}</span>${d.rain ? `<span>${esc(L.w.tipRain(nf(d.rain, 1)))}</span>` : ''}${d.w ? `<span>${esc(L.w.tipWater(nf(d.w, 1)))}</span>` : ''}`;
    tip.style.left = `${Math.min(b.width - 150, Math.max(0, (cx / Wd) * b.width + 12))}px`; tip.style.top = `${(cy / H) * b.height}px`;
  });
  svg.addEventListener('pointerleave', () => { tip.hidden = true; hov.setAttribute('visibility', 'hidden'); });
}

/* ---------- Rain & recharge ---------- */
function viewWaterRain() { return `<div class="fade-in" id="rainPage"></div>`; }
function bindWaterRain() {
  withWeather(w => {
    const el = $('#rainPage'); if (!el) return;
    const wd = wxDays.water(w), out = W.rainOutlook(wd), cat = farm.list('catchments');
    const rech = cat.filter(c => c.to === 'recharge'), stor = cat.filter(c => c.to !== 'recharge'), annual = farm.data.annualRain || 900;
    const T = LANG === 'ta' && typeof WATER_TA !== 'undefined' ? WATER_TA : null;
    const before = T ? T.BEFORE_RAIN : WATER_BEFORE_RAIN;
    const methods = WATER_METHODS.map((m, i) => ({ ...m, ...(T ? T.METHODS[i] : {}) })), uses = T ? T.USES : WATER_USES;
    const steps = list => `<ol class="howto">${list.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
    el.innerHTML = `
      <span class="eyebrow">${esc(L.w.eyebrow)}</span><h1 class="page-title">${esc(L.w.rainTitle)}</h1><p class="page-lede">${esc(L.w.rainLede)}</p>
      ${wNav('rain')}
      <div class="facts">
        <div class="fact"><small>${esc(L.w.rf.last30)}</small><b>${nf(out.last30)} mm</b></div>
        <div class="fact"><small>${esc(L.w.rf.next7)}</small><b>${nf(out.next7)} mm</b></div>
        <div class="fact"><small>${esc(L.w.rf.pit)}</small><b>${litres(W.catchLitres(rech, out.next7))}</b></div>
        <div class="fact"><small>${esc(L.w.rf.store)}</small><b>${litres(W.catchLitres(stor, out.next7))}</b></div>
      </div>
      ${out.big.length ? `<section class="card callout rain"><h2>${esc(L.w.heavy)}</h2>
        <ul class="rain-days">${out.big.map(d => `<li><b>${esc(dayName(d.date, true))}</b> ${nf(d.rain)} mm${d.prob != null ? ` · ${esc(L.w.chance(d.prob))}` : ''}${cat.length ? `<span>${esc(L.w.toRecharge(litres(W.catchLitres(rech, d.rain)), litres(W.catchLitres(stor, d.rain))))}</span>` : ''}</li>`).join('')}</ul>
        <h3>${esc(L.w.beforeRain)}</h3>${steps(before)}</section>`
      : `<section class="card callout"><h2>${esc(L.w.noHeavy)}</h2><p>${esc(L.w.noHeavySub)}</p><details><summary>${esc(L.w.checklist)}</summary>${steps(before)}</details></section>`}
      <section class="section"><div class="section-head"><div><h2>${esc(L.w.landsTitle)}</h2><p>${esc(L.w.landsSub)}</p></div><button class="btn btn-outline" data-w="add-catch">${icon('plus')}${esc(L.w.addCatch)}</button></div>
        ${cat.length ? `<ul class="card rows">${cat.map(c => `<li><div><b>${esc(dn(c.name))}</b><small>${nf(c.m2)} m² (${nf(c.m2 * W.SQFT_PER_M2)} ${LANG === 'ta' ? 'ச.அடி' : 'sq ft'}) · ${esc(L.w.surfaces[c.surface])} · ${esc(L.w.goesTo(c.to))}</small></div>
          <span class="meta">${esc(L.w.per10(litres(W.catchLitres([c], 10))))}</span><button type="button" class="icon-btn" data-w="del-catch" data-id="${c.id}" aria-label="${esc(L.common.del)}: ${esc(dn(c.name))}">${icon('x')}</button></li>`).join('')}</ul>` : `<p class="empty">${esc(L.w.landsNone)}</p>`}
        <label class="inline-field">${esc(L.w.yearly)} <input type="number" min="100" max="5000" step="10" value="${annual}" data-w-annual aria-label="${esc(L.w.yearly)}"> mm</label>
        ${cat.length ? `<p class="big-number">${esc(L.w.yearLine(litres(W.catchLitres(cat, annual)), nf(annual), litres(W.catchLitres(rech, annual)), litres(W.catchLitres(stor, annual))))}</p>` : ''}
      </section>
      <section class="section"><div class="section-head"><div><h2>${esc(L.w.waysTitle)}</h2></div></div>
        ${['recharge', 'store', 'slow'].map(g => `<h3 class="group-title">${esc(L.w.groups[g])}</h3><div class="methods">${methods.filter(m => m.group === g).map(m => `
          <details class="card method"><summary><span>${esc(m.title)}</span><small>${esc(m.best)}</small></summary>
            <p class="muted">${esc(L.w.cost(m.cost))}</p>${steps(m.steps)}<p class="care"><b>${esc(L.w.upkeep)}:</b> ${esc(m.care)}</p>${m.id === 'borepit' ? pitDiagram() : ''}
          </details>`).join('')}</div>`).join('')}
      </section>
      <section class="section"><div class="section-head"><div><h2>${esc(L.w.usesTitle)}</h2></div></div>
        <div class="uses">${uses.map(u => `<div class="card"><h3>${esc(u.title)}</h3><p>${esc(u.text)}</p></div>`).join('')}</div></section>
      <p class="muted fine">${esc(L.w.costNote)}</p>`;
  });
}
function pitDiagram() {
  const P = L.w.pit;
  return `<figure class="pit" role="img" aria-label="${esc(P.aria)}"><svg viewBox="0 0 420 240">
    <rect x="0" y="40" width="420" height="200" class="p-soil"/><rect x="120" y="40" width="180" height="150" class="p-soil2"/>
    <rect x="120" y="40" width="180" height="40" class="p-sand"/><text x="132" y="65" class="svg-label">${esc(P.sand)}</text>
    <rect x="120" y="80" width="180" height="50" class="p-gravel"/><text x="132" y="110" class="svg-label">${esc(P.gravel)}</text>
    <rect x="120" y="130" width="180" height="60" class="p-boulder"/><text x="132" y="165" class="svg-label on-dark">${esc(P.boulders)}</text>
    <rect x="252" y="14" width="16" height="226" class="p-casing"/>
    <g class="p-water">${[96, 116, 136, 156, 176].map(yy => `<circle cx="260" cy="${yy}" r="3"/>`).join('')}</g>
    <rect x="248" y="88" width="24" height="100" fill="none" class="p-outline" stroke-dasharray="3 3"/><text x="282" y="138" class="svg-label">${esc(P.holes)}</text>
    <rect x="20" y="22" width="60" height="30" class="p-soil2 p-outline"/><text x="50" y="16" text-anchor="middle" class="svg-label">${esc(P.trap)}</text>
    <path d="M80 36 H140" class="p-flow" stroke-width="3" marker-end="url(#pa)"/><path d="M190 50 V180" class="p-flow" stroke-width="2" stroke-dasharray="5 5" marker-end="url(#pa)"/>
    <text x="276" y="26" class="svg-label">${esc(P.bore)}</text>
    <defs><marker id="pa" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" class="p-arrow"/></marker></defs>
  </svg></figure>`;
}

/* ---------- Water use ---------- */
function viewWaterUse() {
  const t = todayISO(), from = W.addDays(t, -29);
  const logs = farm.list('logs').filter(l => l.type === 'water' && l.date >= from);
  const total = logs.reduce((s, l) => s + l.litres, 0), mins = logs.reduce((s, l) => s + (l.minutes || 0), 0);
  const kwh = logs.reduce((s, l) => s + W.pumpKwh(wSource(l.sourceId), l.minutes || 0), 0);
  const perDay = Array.from({ length: 30 }, (_, i) => { const d = W.addDays(from, i); return { d, l: logs.filter(x => x.date === d).reduce((s, x) => s + x.litres, 0) }; });
  const max = Math.max(1, ...perDay.map(p => p.l));
  const byField = farm.list('fields').map(f => ({ f, l: logs.filter(x => x.fieldId === f.id).reduce((s, x) => s + x.litres, 0) })).sort((a, b) => b.l - a.l);
  const all = farm.list('logs').slice().sort((a, b) => b.date.localeCompare(a.date)), tanks = farm.list('sources').filter(s => s.capacityL);
  return `<div class="fade-in">
    <span class="eyebrow">${esc(L.w.eyebrow)}</span><h1 class="page-title">${esc(L.w.useTitle)}</h1><p class="page-lede">${esc(L.w.useLede)}</p>
    ${wNav('use')}
    <div class="facts">
      <div class="fact"><small>${esc(L.w.uf.pumped)}</small><b>${litres(total)}</b></div>
      <div class="fact"><small>${esc(L.w.uf.time)}</small><b>${esc(dur(mins))}</b></div>
      <div class="fact"><small>${esc(L.w.uf.kwh)}</small><b>${esc(L.w.uf.units(nf(kwh)))}</b><span class="sub">${esc(L.w.uf.kwhSub)}</span></div>
    </div>
    <section class="section"><div class="section-head"><div><h2>${esc(L.w.perDay)}</h2></div></div>
      <figure class="card daybars" role="img" aria-label="${esc(L.w.perDayAria)}">
        <div class="db-row">${perDay.map(p => `<div class="db" title="${esc(shortDate(p.d))}: ${esc(litres(p.l))}"><span style="height:${(p.l / max) * 100}%"></span></div>`).join('')}</div>
        <figcaption><span>${esc(shortDate(from))}</span><span>${esc(L.w.max(litres(max)))}</span><span>${esc(L.common.today)}</span></figcaption></figure></section>
    <section class="section"><div class="section-head"><div><h2>${esc(L.w.byField)}</h2></div></div>
      <ul class="card rows">${byField.map(({ f, l }) => `<li><div><b>${esc(dn(f.name))}</b><small>${esc(cropName(f.crop))} · ${esc(L.w.mmField(nf(l / (f.acres * W.M2_PER_ACRE))))}</small></div><span class="meta">${litres(l)}</span></li>`).join('')}</ul></section>
    <section class="section"><div class="section-head"><div><h2>${esc(L.w.tanks)}</h2></div></div>
      ${tanks.map(s => `<div class="card tank"><div><b>${esc(dn(s.name))}</b> ${esc(L.w.of(litres(s.levelL || 0), litres(s.capacityL)))}</div>${meter((s.levelL || 0) / s.capacityL, 'water')}<button class="link" data-w="set-level" data-id="${s.id}">${esc(L.w.setLevel)}</button></div>`).join('') || `<p class="empty">${esc(L.w.tanksNone)}</p>`}</section>
    <section class="section"><div class="section-head"><div><h2>${esc(L.w.allEntries)}</h2></div></div>
      ${all.length ? `<ul class="card rows">${all.slice(0, 60).map(logRow).join('')}</ul>` : `<p class="empty">${esc(L.w.nothingLogged)}</p>`}</section>
  </div>`;
}

/* ---------- Forms ---------- */
const optsOf = obj => Object.keys(obj).map(k => [k, obj[k]]);
function editField(f) {
  const isNew = !f;
  if (!farm.list('sources').length) return editSource(null, () => editField());
  f = f || { name: '', crop: 'tomato', acres: 1, soil: 'red', method: 'drip', sown: todayISO(), sourceId: farm.list('sources')[0].id };
  openForm({ title: isNew ? L.w.addField : L.w.editField, fields: [
    { name: 'name', label: L.w.fName, value: f.name, required: true, placeholder: LANG === 'ta' ? 'உ.தா. கிழக்கு வயல்' : 'e.g. East plot' },
    { name: 'crop', label: L.w.fCrop, type: 'select', value: f.crop, options: optsOf(L.w.crops) },
    { name: 'acres', label: L.w.fAcres, type: 'number', step: 0.05, min: 0.01, value: f.acres, required: true },
    { name: 'soil', label: L.w.fSoil, type: 'select', value: f.soil, options: optsOf(L.w.soils) },
    { name: 'method', label: L.w.fMethod, type: 'select', value: f.method, options: optsOf(L.w.methods) },
    { name: 'sown', label: L.w.fSown, type: 'date', value: f.sown || '', help: L.w.fSownHelp },
    { name: 'sourceId', label: L.w.fFrom, type: 'select', value: f.sourceId, options: farm.list('sources').map(s => [s.id, dn(s.name)]) },
  ], extra: isNew ? '' : `<button type="button" class="link danger" id="delField">${esc(L.w.delField)}</button>`,
  onSave: d => { const rec = { ...d, acres: Number(d.acres) }; if (isNew) farm.add('fields', rec); else farm.update('fields', f.id, rec); rerender(); } });
  $('#delField')?.addEventListener('click', () => {
    if (!confirmAsk(L.w.delFieldQ)) return;
    farm.remove('fields', f.id); farm.set('logs', farm.list('logs').filter(l => l.fieldId !== f.id));
    formDlg.close(); location.hash = '#/water/fields';
  });
}
function editSource(s, then) {
  const isNew = !s;
  s = s || { name: L.w.kinds.borewell, kind: 'borewell', flowLpm: 200, hp: 5, capacityL: '', levelL: '' };
  openForm({ title: isNew ? L.w.addSourceT : L.w.editSource, lede: isNew && !farm.list('sources').length ? L.w.firstSource : '', fields: [
    { name: 'name', label: L.w.fName, value: s.name, required: true },
    { name: 'kind', label: L.w.sType, type: 'select', value: s.kind, options: optsOf(L.w.kinds) },
    { name: 'flowLpm', label: L.w.sFlow, type: 'number', min: 1, value: s.flowLpm, required: true, help: L.w.sFlowHelp },
    { name: 'hp', label: L.w.sHp, type: 'number', step: 0.5, min: 0, value: s.hp ?? '' },
    { name: 'capacityL', label: L.w.sCap, type: 'number', min: 0, value: s.capacityL || '', help: L.w.sCapHelp },
    { name: 'levelL', label: L.w.sLevel, type: 'number', min: 0, value: s.levelL || '' },
  ], extra: isNew ? '' : `<button type="button" class="link danger" id="delSource">${esc(L.w.delSource)}</button>`,
  onSave: d => {
    const rec = { ...d, flowLpm: Number(d.flowLpm), hp: Number(d.hp) || 0, capacityL: Number(d.capacityL) || 0, levelL: Number(d.levelL) || 0 };
    if (isNew) farm.add('sources', rec); else farm.update('sources', s.id, rec);
    if (then) setTimeout(then, 0); else rerender();
  } });
  $('#delSource')?.addEventListener('click', () => {
    if (farm.list('fields').some(f => f.sourceId === s.id)) { alert(L.w.sourceInUse); return; }
    farm.remove('sources', s.id); formDlg.close(); rerender();
  });
}
function addLog(l) {
  farm.add('logs', l);
  const s = wSource(l.sourceId);
  if (s?.capacityL && l.type === 'water') farm.update('sources', s.id, { levelL: Math.max(0, (s.levelL || 0) - l.litres) });
  rerender(); toast(L.w.logged(litres(l.litres), dn(wField(l.fieldId)?.name || '')));
}
function logWatering(f) {
  openForm({ title: `${L.w.logWatering} · ${dn(f.name)}`, fields: [
    { name: 'date', label: L.w.lDate, type: 'date', value: todayISO(), max: todayISO(), required: true },
    { name: 'sourceId', label: L.w.fFrom, type: 'select', value: f.sourceId, options: farm.list('sources').map(x => [x.id, `${dn(x.name)} (${L.w.flow(x.flowLpm)})`]) },
    { name: 'minutes', label: L.w.lMinutes, type: 'number', min: 0, step: 1, placeholder: '90' },
    { name: 'litres', label: L.w.lLitres, type: 'number', min: 0, step: 10, placeholder: L.w.lLitresPh },
    { name: 'note', label: L.w.lNote, placeholder: L.common.optional },
  ], onSave: (d, form) => {
    const src = wSource(d.sourceId), minutes = Number(d.minutes) || 0, l = Number(d.litres) || minutes * (src?.flowLpm || 0);
    if (!l) { const m = form.querySelector('[name=minutes]'); m.setCustomValidity(L.w.lNeed); form.reportValidity(); m.setCustomValidity(''); return false; }
    addLog({ type: 'water', fieldId: f.id, sourceId: src?.id, date: d.date, minutes: minutes || Math.round(l / (src?.flowLpm || 1)), litres: l, note: d.note });
  } });
}
function soilCheck(f) {
  openForm({ title: `${L.w.scTitle} · ${dn(f.name)}`, lede: L.w.scLede, fields: [{ name: 'level', label: L.w.scTitle, type: 'radio', required: true,
    options: [['0', L.w.check.wet, L.w.scWet], ['0.4', L.w.check.moist, L.w.scMoist], ['0.8', L.w.check.dry, L.w.scDry]] }],
  onSave: d => { farm.add('logs', { type: 'check', fieldId: f.id, date: todayISO(), level: Number(d.level) }); rerender(); toast(L.w.scSaved); } });
}
function addCatchment() {
  openForm({ title: L.w.cTitle, lede: L.w.cNote, fields: [
    { name: 'name', label: L.w.fName, required: true, placeholder: LANG === 'ta' ? 'உ.தா. வீட்டு மொட்டைமாடி' : 'e.g. House terrace' },
    { name: 'surface', label: L.w.cSurface, type: 'select', value: 'concrete', options: optsOf(L.w.surfaces) },
    { name: 'to', label: L.w.cTo, type: 'select', value: 'sump', options: [['sump', L.w.cStore], ['recharge', L.w.cPit]] },
    { name: 'area', label: L.w.cArea, type: 'number', min: 1, required: true, placeholder: '1200' },
    { name: 'unit', label: L.w.cUnit, type: 'select', value: 'sqft', options: [['sqft', LANG === 'ta' ? 'ச.அடி' : 'sq ft'], ['m2', 'm²']] },
  ], onSave: d => { const m2 = d.unit === 'sqft' ? Number(d.area) / W.SQFT_PER_M2 : Number(d.area); farm.add('catchments', { name: d.name, surface: d.surface, to: d.to, m2 }); rerender(); } });
}
function setLevel(s) {
  openForm({ title: L.w.levelTitle(dn(s.name)), lede: L.w.levelMax(litres(s.capacityL)), fields: [{ name: 'levelL', label: L.w.sLevel, type: 'number', min: 0, max: s.capacityL, value: s.levelL || 0, required: true }],
    onSave: d => { farm.update('sources', s.id, { levelL: Number(d.levelL) }); rerender(); } });
}
function startPump(f) {
  const s = wSource(f.sourceId), w = weatherNow(), a = w ? W.advise(f, wxDays.water(w), farm.list('logs'), s) : null;
  farm.set('running', { fieldId: f.id, sourceId: s.id, start: Date.now(), target: a?.amount?.litres > 0 ? a.amount.litres : null });
  rerender();
}
function stopPump() {
  const r = farm.data.running; if (!r) return;
  const s = wSource(r.sourceId), minutes = Math.max(1, Math.round((Date.now() - r.start) / 60000));
  farm.set('running', null); clearInterval(pumpTick);
  addLog({ type: 'water', fieldId: r.fieldId, sourceId: r.sourceId, date: todayISO(), minutes, litres: minutes * (s?.flowLpm || 0) });
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-w]'); if (!b) return;
  const id = b.dataset.id, act = b.dataset.w;
  if (act === 'add-field') editField();
  else if (act === 'edit-field') editField(wField(id));
  else if (act === 'add-source') editSource();
  else if (act === 'edit-source') editSource(wSource(id));
  else if (act === 'pump') startPump(wField(id));
  else if (act === 'stop') stopPump();
  else if (act === 'log') logWatering(wField(id));
  else if (act === 'check') soilCheck(wField(id));
  else if (act === 'add-catch') addCatchment();
  else if (act === 'set-level') setLevel(wSource(id));
  else if (act === 'del-log') { const r = farm.remove('logs', id); rerender(); if (r) toast(L.w.entryDeleted, () => { farm.restore('logs', r.gone, r.i); rerender(); }); }
  else if (act === 'del-catch') { const r = farm.remove('catchments', id); rerender(); if (r) toast(L.w.removed(dn(r.gone.name)), () => { farm.restore('catchments', r.gone, r.i); rerender(); }); }
});
document.addEventListener('change', e => { if (e.target.matches('[data-w-annual]')) { farm.set('annualRain', Math.max(100, Number(e.target.value) || 900)); rerender(); } });
