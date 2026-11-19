// Drying section (from Solar Dry House): today's drying weather with the estimated inside temperature,
// 58 materials with a drying curve and ready dates from the live forecast, a batch planner and a guide.
const DRY_BY_ID = Object.fromEntries(DRY_MATERIALS.map(m => [m.id, m]));
const DRY_POPULAR = ['red-chilli', 'turmeric', 'moringa', 'copra', 'mango', 'tomato', 'curry-leaves', 'salted-fish'];
const dState = { q: '', cat: 'all', target: store.get('dryTarget', 3), area: store.get('dryArea', 36) };
const dNav = on => subnav([['today', '#/drying', L.d.nav.today], ['materials', '#/drying/materials', L.d.nav.materials], ['plan', '#/drying/plan', L.d.nav.plan], ['guide', '#/drying/guide', L.d.nav.guide]], on, L.titles.drying);
// Material text in the current language; the other language's name is the subtitle.
function mat(m) {
  const t = LANG === 'ta' && typeof DRY_TA !== 'undefined' ? DRY_TA[m.id] : null;
  return { ...m, name: t ? t.name : m.name, prep: t ? t.prep : m.prep, done: t ? t.done : m.done, tip: t ? t.tip : m.tip, alt: t ? m.name : (DRY_TA?.[m.id]?.name || '') };
}
const range = a => (a[0] === a[1] ? `${a[0]}` : `${a[0]}–${a[1]}`);
function fmtDays(x) {
  if (x === 0) return L.d.already;
  const h = Math.max(0.5, Math.ceil(x * 2) / 2);
  return `${h % 1 ? nf(h, 1) : h} ${L.d.day(h)}`;
}
const dImg = (id, alt = '') => `<img src="img/dry/${id}.jpg" alt="${esc(alt)}" loading="lazy" decoding="async">`;
function dBadge(m, t) {
  const n = FFDry.daysTo(m, t);
  if (n == null) return `<span class="badge none">${esc(L.d.cantReach(t))}</span>`;
  return `<span class="badge ${n <= 3 ? 'good' : n <= 8 ? 'fair' : 'poor'}">${esc(L.d.daysTo(fmtDays(n), t))}</span>`;
}
function mCard(raw) {
  const m = mat(raw);
  return `<a class="card mcard" href="#/drying/m/${m.id}"><div class="mph">${dImg(m.id)}</div><div class="mb"><h3>${esc(m.name)}</h3><span class="ta">${esc(m.alt || m.aka.slice(0, 2).join(' · '))}</span>${dBadge(m, dState.target)}</div></a>`;
}
const ratingWord = k => L.d.rating[k];

/* ---------- Drying today ---------- */
function viewDrying() { return `<div class="fade-in" id="dryPage"></div>`; }
function bindDrying() {
  withWeather((w, failed) => {
    const el = $('#dryPage'); if (!el) return;
    const F = wxDays.dry(w), hour = new Date().getHours();
    const head = `<span class="eyebrow">${esc(L.d.greet(hour))}</span>`;
    if (!F.length) { el.innerHTML = `${head}<h1 class="page-title">${esc(failed ? L.wxFail : L.w.fetching)}</h1>${dNav('today')}${failed ? `<p class="muted">${esc(L.wxFailSub)}</p>` : '<div class="skeleton" style="height:220px"></div>'}`; return; }
    const c = w.d.current, today = F[0], cw = FFWx.code(c.weather_code);
    const rise = c.is_day ? FFWx.houseRiseNow(c.shortwave_radiation) : 1;
    const inT = c.temperature_2m + rise, inRH = FFWx.houseRH(c.relative_humidity_2m, rise), r = FFWx.rating(today.f);
    const skin = !c.is_day ? 'night' : cw.icon === 'rain' || cw.icon === 'storm' ? 'rainy' : cw.icon === 'cloud' || cw.icon === 'fog' ? 'cloudy' : 'sunny';
    const sunrise = ((F[1] || today).sunrise || '').slice(11, 16) || '6:00';
    const headline = !c.is_day ? L.d.head.night : L.d.head[r];
    const tip = !c.is_day ? L.d.tip.night(sunrise) : inT > 62 ? L.d.tip.hot : c.shortwave_radiation < 200 ? L.d.tip.weak : L.d.tip.good;
    const best = FFDry.bestStart(F, hour), p = place();
    el.innerHTML = `${head}<h1 class="page-title">${esc(headline)}</h1>
      ${dNav('today')}
      <section class="dhero ${skin}">
        <div class="dhero-top">${icon(c.is_day ? cw.icon : 'cloud')}<div class="dtemp">${nf(c.temperature_2m)}°</div>
          <div class="dcond"><b>${esc(L.wx[cw.word])}</b><small>${esc(L.d.outside(p.mine ? L.myFarm : p.name, c.relative_humidity_2m))}</small></div>
          <span class="badge ${r}">${esc(L.d.ratingToday(ratingWord(r)))}</span></div>
        <div class="dstats" aria-label="${esc(L.d.insideAria)}">
          <div><span>${esc(L.d.inAir)}</span><b class="${inT > 62 ? 'hot' : ''}">${nf(inT)}°C</b></div>
          <div><span>${esc(L.d.inRH)}</span><b>${nf(inRH)}%</b></div>
          <div><span>${esc(L.d.sun)}</span><b>${esc(L.d.mj(nf(today.rad)))}</b></div>
        </div>
        <p class="dtip">${icon(c.is_day ? 'sun' : 'clock')}<span>${esc(tip)}</span></p>
      </section>
      <section class="section"><div class="section-head"><div><h2>${esc(L.d.nextDays(F.length))}</h2><p>${esc(L.d.midday)}</p></div></div>
        <div class="ddays" role="list">${F.map((d, i) => { const dc = FFWx.code(d.code), rr = FFWx.rating(d.f);
          return `<div class="dday ${i === 0 ? 'today' : ''}" role="listitem" title="${esc(L.wx[dc.word])} · ${Math.round(d.tmax)}° · ${Math.round(d.rh)}% · ${d.rain}%">
            <span class="d">${esc(i === 0 ? L.common.today : dayName(d.date))}</span>${icon(dc.icon)}<span class="t">${nf(d.house)}°</span><span class="s"><i class="dot ${rr}"></i>${esc(ratingWord(rr))}</span></div>`; }).join('')}</div>
        <p class="muted fine">${esc(L.d.live(new Date(w.t).toLocaleTimeString(L.locale, { hour: 'numeric', minute: '2-digit' }), Date.now() - w.t > 30 * 60e3))}</p>
      </section>
      <div class="two-col">
        <div class="card note-card"><span class="org-icon t-seed">${icon('sun')}</span><div><span class="eyebrow">${esc(L.d.best)}</span><h3>${esc(L.d.bestTitle(dayName(best.date, true)))}</h3>
          <p>${esc(best.slow ? L.d.bestSlow(best.slow) : L.d.bestGood(nf(best.days, 1)))}</p></div></div>
        <a class="card note-card" href="#/drying/materials"><span class="org-icon t-liquid">${icon('search')}</span><div><span class="eyebrow">${esc(L.d.nMaterials(DRY_MATERIALS.length))}</span><h3>${esc(L.d.whatTitle)}</h3><p>${esc(L.d.whatSub(dState.target))}</p></div></a>
      </div>
      <section class="section"><div class="section-head"><div><h2>${esc(L.d.popular)}</h2></div><a class="link" href="#/drying/materials">${esc(L.common.seeAll)}${icon('next')}</a></div>
        <div class="rail">${DRY_POPULAR.map(id => mCard(DRY_BY_ID[id])).join('')}</div></section>
      <p class="muted fine">${esc(L.d.honesty)}</p>`;
  });
}

/* ---------- Materials ---------- */
function viewDryMaterials() {
  const targets = [3, 5, 8, 10];
  if (!targets.includes(dState.target)) dState.target = 3;
  return `<div class="fade-in">
    <span class="eyebrow">${esc(L.d.eyebrow)}</span><h1 class="page-title">${esc(L.d.matTitle)}</h1><p class="page-lede">${esc(L.d.matLede(DRY_MATERIALS.length))}</p>
    ${dNav('materials')}
    <label class="search">${icon('search')}<input id="dq" type="search" placeholder="${esc(L.d.searchPh)}" value="${esc(dState.q)}" aria-label="${esc(L.d.searchPh)}" autocomplete="off"></label>
    <div class="chips scroll" id="dCats">${[['all', L.d.all], ...DRY_CATEGORIES.map(c => [c, L.d.cats[c]])].map(([k, v]) => `<button type="button" class="chip ${k === dState.cat ? 'on' : ''}" data-dcat="${k}" aria-pressed="${k === dState.cat}">${esc(v)}</button>`).join('')}</div>
    <div class="filter-row"><span id="dtl">${esc(L.d.dryTo)}</span>
      <div class="seg" id="dTarget" role="group" aria-labelledby="dtl">${targets.map(v => `<button type="button" data-t="${v}" class="${v === dState.target ? 'on' : ''}" aria-pressed="${v === dState.target}">${v}%</button>`).join('')}</div>
      <span class="muted" id="dCount"></span></div>
    <div class="grid" id="dList"></div>
    <p class="muted fine">${esc(L.d.fine)}</p>
  </div>`;
}
function bindDryMaterials() {
  const draw = () => {
    const t = dState.target, words = dState.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = DRY_MATERIALS.filter(m => (dState.cat === 'all' || m.cat === dState.cat) && (!words.length || words.every(w =>
      [m.name, L.d.cats[m.cat], ...m.aka, DRY_TA?.[m.id]?.name || ''].join(' ').toLowerCase().includes(w))))
      .map(mat).sort((a, b) => a.name.localeCompare(b.name, L.locale));
    $('#dCount').textContent = L.d.countLine(list.length, list.filter(m => FFDry.daysTo(m, t) != null).length, t);
    $('#dList').innerHTML = list.length ? list.map(m => mCard(DRY_BY_ID[m.id])).join('') : `<p class="empty">${esc(L.d.noMatch(dState.q))}</p>`;
  };
  $('#dq').addEventListener('input', e => { dState.q = e.target.value; draw(); });
  $('#dCats').addEventListener('click', e => { const b = e.target.closest('[data-dcat]'); if (!b) return; dState.cat = b.dataset.dcat;
    $('#dCats').querySelectorAll('.chip').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); draw(); });
  $('#dTarget').addEventListener('click', e => { const b = e.target.closest('[data-t]'); if (!b) return; dState.target = +b.dataset.t; store.set('dryTarget', dState.target);
    $('#dTarget').querySelectorAll('button').forEach(x => { x.classList.toggle('on', x === b); x.setAttribute('aria-pressed', x === b); }); draw(); });
  draw();
}

/* ---------- Material page ---------- */
function curveSVG(m, target) {
  const Wd = 480, H = 230, pl = 40, pr = 12, pt = 14, pb = 36;
  const tSafe = FFDry.daysTo(m, m.ms), tT = FFDry.daysTo(m, target);
  const span = Math.max(2, Math.ceil(Math.max(tSafe, tT ?? 0, m.d[1]) * 1.25));
  const db = v => v / (100 - v), wb = X => (100 * X) / (1 + X);
  const X0 = db(m.mi), Xe = db(m.me), k = Math.log((X0 - Xe) / (db(m.ms) - Xe)) / ((m.d[0] + m.d[1]) / 2);
  const yMax = Math.ceil(m.mi / 10) * 10;
  const x = d => pl + (d / span) * (Wd - pl - pr), y = v => pt + (1 - v / yMax) * (H - pt - pb);
  let path = '';
  for (let i = 0; i <= 80; i++) { const d = (span * i) / 80; path += `${i ? 'L' : 'M'}${x(d).toFixed(1)} ${y(wb(Xe + (X0 - Xe) * Math.exp(-k * d))).toFixed(1)}`; }
  const step = span > 14 ? Math.ceil(span / 7) : span > 7 ? 2 : 1, xt = [], yt = [];
  for (let d = 0; d <= span; d += step) xt.push(d);
  for (let v = 0; v <= yMax; v += yMax > 50 ? 20 : 10) yt.push(v);
  const hline = (v, cls, lab, pos) => v <= yMax ? `<line x1="${pl}" x2="${Wd - pr}" y1="${y(v)}" y2="${y(v)}" class="${cls}" stroke-dasharray="4 4"/><text x="${pos === 'left' ? pl + 6 : Wd - pr}" y="${pos === 'below' && y(v) + 15 < H - pb - 2 ? y(v) + 15 : y(v) - 6}" text-anchor="${pos === 'left' ? 'start' : 'end'}" class="${cls}-t">${esc(lab)}</text>` : '';
  const dot = (d, v, cls) => (d == null || d > span ? '' : `<circle cx="${x(d)}" cy="${y(v)}" r="5" class="${cls}"/>`);
  return `<svg class="curve" viewBox="0 0 ${Wd} ${H}" role="img" aria-label="${esc(L.d.curveAria(m.name, m.mi, m.ms, fmtDays(tSafe)))}">
    ${yt.map(v => `<line x1="${pl}" x2="${Wd - pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${v}%</text>`).join('')}
    ${xt.map(d => `<text x="${x(d)}" y="${H - pb + 18}" text-anchor="middle" class="ax">${d}</text>`).join('')}
    <text x="${(pl + Wd - pr) / 2}" y="${H - 2}" text-anchor="middle" class="ax">${esc(L.d.sunnyDays)}</text>
    <path d="${path}L${x(span)} ${y(0)}L${x(0)} ${y(0)}Z" class="area"/>
    ${hline(m.ms, 'c-safe', L.d.safeL(m.ms), 'above')}${hline(m.me, 'c-low', L.d.lowestL(m.me), 'below')}
    ${target !== m.ms && target > m.me ? hline(target, 'c-target', L.d.targetL(target), 'left') : ''}
    <path d="${path}" class="ln"/>${dot(tSafe, m.ms, 'c-safe-dot')}${dot(tT, target, 'c-target-dot')}
  </svg>`;
}
function viewDryMaterial(id) { return DRY_BY_ID[id] ? `<div class="fade-in" id="dmPage"></div>` : notFound(); }
function bindDryMaterial(id) {
  withWeather(w => {
    const el = $('#dmPage'); if (!el) return;
    const m = mat(DRY_BY_ID[id]), t = dState.target, nT = FFDry.daysTo(m, t), nS = FFDry.daysTo(m, m.ms), F = wxDays.dry(w), hour = new Date().getHours();
    const fS = F.length ? FFDry.finishDate(nS, F, hour) : null, fT = F.length && nT != null ? FFDry.finishDate(nT, F, hour) : null;
    const pct = v => Math.min(100, Math.max(0, ((v - 30) / 40) * 100)), cr = DRY_CREDITS[m.id], low = m.name.toLocaleLowerCase(L.locale);
    let heat = '';
    if (F.length) {
      const next = F.slice(0, 5), hot = next.filter(d => d.house > m.t[1] + 2), cool = next.filter(d => d.house < m.t[0] - 5);
      heat = hot.length ? `<p class="note bad">${icon('alert')}<span>${esc(L.d.hot(low, hot.map(d => L.d.hotDay(dayName(d.date), nf(d.house))).join(', '), m.t[1]))}</span></p>`
        : cool.length >= 3 ? `<p class="note info">${icon('cloud')}<span>${esc(L.d.cool)}</span></p>`
        : `<p class="note ok">${icon('check')}<span>${esc(L.d.suits(low, range(m.t)))}</span></p>`;
    }
    const verdict = nT == null ? `<p class="note warn">${icon('alert')}<span>${esc(L.d.cant(m.name, t, m.me, m.ms))}</span></p>`
      : nT > nS * 2.2 && t < m.ms ? `<p class="note info">${icon('clock')}<span>${esc(L.d.extra(m.ms, t, fmtDays(nT - nS)))}</span></p>` : '';
    const when = f => `${f.beyond ? L.d.about : ''}${dayName(f.date, true)}`;
    el.innerHTML = `<a class="back" href="#/drying/materials">${icon('back')}${esc(L.d.nav.materials)}</a>
      <div class="detail-hero">
        <figure class="detail-photo" style="margin:0">${dImg(m.id, m.name)}${cr ? `<figcaption>${esc(cr.author)} · ${esc(cr.license)}</figcaption>` : ''}</figure>
        <div class="detail-head"><span class="eyebrow">${esc(L.d.cats[m.cat])}</span><h1>${esc(m.name)}</h1>${m.alt ? `<div class="ta">${esc(m.alt)}</div>` : ''}<div class="sci">${esc(m.aka.join(' · '))}</div>
          <div class="facts compact">
            <div class="fact"><small>${esc(L.d.safe)}</small><b>${range(m.d)} ${esc(L.d.day(m.d[1]))}</b><span class="sub">${esc(L.d.moist(m.mi, m.ms))}</span></div>
            <div class="fact"><small>${esc(L.d.toPct(t))}</small>${nT == null ? `<b class="bad">${esc(L.d.notPossible)}</b><span class="sub">${esc(L.d.lowest(m.me))}</span>` : `<b>${esc(fmtDays(nT))}</b><span class="sub">${esc(L.d.sunny)}</span>`}</div>
            <div class="fact"><small>${esc(L.d.air)}</small><b>${range(m.t)}°C</b><span class="sub">${esc(L.d.openSun(range(m.o)))}</span></div>
          </div></div>
      </div>
      ${verdict}${heat}
      <div class="org-layout">
        <div class="card chart-card"><h2>${esc(L.d.curve)}</h2>${curveSVG(m, t)}
          <div class="legend"><span><i class="k-moist"></i>${esc(L.d.lg.moist)}</span><span><i class="k-safe"></i>${esc(L.d.lg.safe)}</span>${nT != null && t !== m.ms ? `<span><i class="k-target"></i>${esc(L.d.lg.target)}</span>` : ''}<span><i class="k-low"></i>${esc(L.d.lg.lowest)}</span></div></div>
        <aside class="mini-stack">
          ${fS ? `<div class="card plan-card"><span class="eyebrow">${esc(L.d.withForecast(place().mine ? L.myFarm : place().name))}</span><h2>${esc(fS.startsTomorrow ? L.d.loadTomorrow : L.d.loadToday)}</h2>
            <div class="kv"><span>${esc(L.d.safeAt(m.ms))}</span><b>${esc(when(fS))}</b></div>
            <div class="kv"><span>${esc(L.d.targetAt(t))}</span>${nT == null ? `<b class="bad">${esc(L.d.cantShort)}</b>` : `<b>${esc(when(fT))}</b>`}</div></div>` : `<div class="card"><p>${esc(L.d.gettingForecast)}</p></div>`}
          <div class="card"><span class="eyebrow">${esc(L.d.airTemp)}</span>
            <div class="therm" aria-label="${esc(L.d.band(range(m.t)))}"><div class="tbar"><i style="left:${pct(m.t[0])}%;width:${Math.max(pct(m.t[1]) - pct(m.t[0]), 2)}%"></i>${F.length ? `<u style="left:${pct(F[0].house)}%"></u>` : ''}</div>
              <div class="tscale"><span>30</span><span>40</span><span>50</span><span>60</span><span>70°C</span></div></div>
            <p>${esc(L.d.keepAt(range(m.t)))}${F.length ? esc(L.d.todayInside(nf(F[0].house))) : ''}</p></div>
        </aside>
      </div>
      <section class="section"><div class="section-head"><div><h2>${esc(L.d.howTitle)}</h2></div></div>
        <div class="steps">
          <div class="card step"><span class="step-num">1</span><div><h3>${esc(L.d.prepare)}</h3><p>${esc(m.prep)}</p></div></div>
          <div class="card step"><span class="step-num">2</span><div><h3>${esc(L.d.load)}</h3><p>${esc(L.d.loadText(m.load))}${m.tip ? ' ' + esc(m.tip) : ''}</p></div></div>
          <div class="card step"><span class="step-num">3</span><div><h3>${esc(L.d.doneWhen)}</h3><p>${esc(m.done)}</p></div></div>
          <div class="card step"><span class="step-num">4</span><div><h3>${esc(L.d.store)}</h3><p>${esc(L.d.storeText(m.keep, nf(FFDry.driedWeight(100, m.mi, m.ms)), nT != null ? L.d.storeAlt(nf(FFDry.driedWeight(100, m.mi, t)), t) : ''))}</p></div></div>
        </div></section>
      <a class="btn btn-primary" href="#/drying/plan/${m.id}">${icon('scale')}${esc(L.d.planBtn(low))}</a>
      ${cr ? `<p class="muted fine">${esc(L.d.photo(cr.author, cr.license))} <a class="link" href="${esc(cr.page)}" target="_blank" rel="noopener">Wikimedia Commons</a></p>` : ''}`;
  });
}

/* ---------- Plan a batch ---------- */
function viewDryPlan(id) {
  const sel = DRY_BY_ID[id] || DRY_BY_ID['red-chilli'];
  return `<div class="fade-in">
    <span class="eyebrow">${esc(L.d.planEyebrow)}</span><h1 class="page-title">${esc(L.d.planTitle)}</h1><p class="page-lede">${esc(L.d.planLede)}</p>
    ${dNav('plan')}
    <div class="org-layout">
      <form class="card dform" id="dForm" novalidate>
        <div class="picked"><img id="cImg" src="img/dry/${sel.id}.jpg" alt=""><label class="field" style="flex:1"><span>${esc(L.d.material)}</span>
          <select id="cM">${DRY_CATEGORIES.map(c => `<optgroup label="${esc(L.d.cats[c])}">${DRY_MATERIALS.filter(m => m.cat === c).map(m => `<option value="${m.id}" ${m.id === sel.id ? 'selected' : ''}>${esc(mat(m).name)}</option>`).join('')}</optgroup>`).join('')}</select></label></div>
        <label class="field"><span>${esc(L.d.fresh)}</span><input id="cKg" type="number" min="1" step="1" value="200" inputmode="decimal"></label>
        <div class="pair"><label class="field"><span>${esc(L.d.startM)}</span><input id="cMi" type="number" min="5" max="97" step="1" inputmode="decimal"></label>
          <label class="field"><span>${esc(L.d.target)}</span><input id="cMf" type="number" min="1" max="40" step="0.5" inputmode="decimal"></label></div>
        <label class="field"><span>${esc(L.d.trays)}</span><input id="cArea" type="number" min="1" step="0.5" value="${dState.area}" inputmode="decimal"><small>${esc(L.d.traysHelp)}</small></label>
      </form>
      <div class="mini-stack" aria-live="polite">
        <div class="calc-grid">
          <div class="card"><small>${esc(L.d.rWater)}</small><b id="rWater">–</b><em id="rWater2"></em></div>
          <div class="card"><small>${esc(L.d.rDry)}</small><b id="rDry">–</b><em id="rRatio"></em></div>
          <div class="card"><small>${esc(L.d.rArea)}</small><b id="rArea">–</b><em id="rLoad"></em></div>
          <div class="card"><small>${esc(L.d.rDays)}</small><b id="rDays">–</b><em id="rReady"></em></div>
        </div>
        <div class="massbar" aria-hidden="true"><div class="w" id="bW"></div><div class="dr" id="bD"></div></div>
        <p class="note" id="rNote"></p>
        <p class="muted fine">${esc(L.d.formula)}</p>
      </div>
    </div>
  </div>`;
}
function bindDryPlan() {
  const g = s => document.getElementById(s);
  const setM = () => { const m = DRY_BY_ID[g('cM').value]; g('cImg').src = `img/dry/${m.id}.jpg`; g('cMi').value = m.mi; g('cMf').value = dState.target > m.me ? dState.target : m.ms; calc(); };
  const say = (cls, ic, text) => { const n = g('rNote'); n.className = `note ${cls}`; n.innerHTML = `${icon(ic)}<span>${esc(text)}</span>`; };
  const calc = () => {
    const m = mat(DRY_BY_ID[g('cM').value]), kg = +g('cKg').value, mi = +g('cMi').value, mf = +g('cMf').value, area = +g('cArea').value;
    if (!(kg > 0) || !(mi > 0) || !(mf > 0) || mf >= mi || mi >= 100) { ['rWater', 'rDry', 'rArea', 'rDays'].forEach(s => (g(s).textContent = '–')); return say('warn', 'alert', L.d.calcWarn); }
    if (area > 0) { dState.area = area; store.set('dryArea', area); }
    const dry = FFDry.driedWeight(kg, mi, mf), water = kg - dry, need = kg / m.load;
    g('rWater').textContent = `${nf(water)} kg`; g('rWater2').textContent = L.d.pctFresh(nf((water / kg) * 100));
    g('rDry').textContent = `${nf(dry, dry < 10 ? 1 : 0)} kg`; g('rRatio').textContent = L.d.ratio(nf(kg / dry, 1));
    g('rArea').textContent = `${nf(need, 1)} m²`; g('rLoad').textContent = L.d.atLoad(m.load);
    const n = FFDry.daysTo({ ...m, mi }, mf), w = weatherNow(), F = wxDays.dry(w);
    g('rDays').textContent = n == null ? L.d.notPossible : fmtDays(n);
    const f = n != null && F.length ? FFDry.finishDate(n, F, new Date().getHours()) : null;
    g('rReady').textContent = n == null ? L.d.levelsOff(m.me) : f ? L.d.ready(f.beyond ? L.d.about : '', dayName(f.date, true)) : L.d.sunny;
    g('bW').style.width = `${(water / kg) * 100}%`; g('bW').textContent = L.d.waterBar(nf(water));
    g('bD').style.width = `${(dry / kg) * 100}%`; g('bD').textContent = L.d.dried;
    if (n == null) say('bad', 'alert', L.d.calcCant(m.name, mf, m.ms, m.me));
    else if (area > 0 && need <= area) say('ok', 'check', L.d.fits(nf((need / area) * 100), nf(area, 1), range(m.t)));
    else if (area > 0) { const b = Math.ceil(need / area); say('warn', 'alert', L.d.tooMuch(nf(need, 1), nf(area, 1), b, nf(kg / b))); }
    else say('warn', 'alert', L.d.enterArea);
  };
  g('cM').addEventListener('change', () => { history.replaceState(null, '', `#/drying/plan/${g('cM').value}`); setM(); });
  ['cKg', 'cMi', 'cMf', 'cArea'].forEach(s => g(s).addEventListener('input', calc));
  g('dForm').addEventListener('submit', e => e.preventDefault());
  setM();
  if (!weatherNow()) fetchWeather().then(() => { if (g('cM')) calc(); }).catch(() => {});
}

/* ---------- Guide ---------- */
function viewDryGuide() {
  const G = LANG === 'ta' && typeof DRY_GUIDE_TA !== 'undefined' ? DRY_GUIDE_TA : DRY_GUIDE;
  return `<div class="fade-in">
    <span class="eyebrow">${esc(L.d.gEyebrow)}</span><h1 class="page-title">${esc(L.d.gTitle)}</h1><p class="page-lede">${esc(G.intro)}</p>
    ${dNav('guide')}
    <figure class="card house-art" aria-hidden="true"><svg viewBox="0 0 260 150"><circle cx="58" cy="40" r="20" class="h-sun"/>
      <path d="M40 128V84Q130 18 220 84V128Z" class="h-sheet"/><rect x="34" y="126" width="192" height="8" rx="4" class="h-floor"/>
      <g class="h-tray"><rect x="80" y="108" width="100" height="6" rx="3"/><rect x="80" y="92" width="100" height="6" rx="3"/></g>
      <g class="h-chilli"><circle cx="96" cy="88" r="3.5"/><circle cx="108" cy="88" r="3.5"/><circle cx="120" cy="88" r="3.5"/></g>
      <g class="h-leaf"><ellipse cx="146" cy="104" rx="6" ry="3"/><ellipse cx="160" cy="104" rx="6" ry="3"/></g></svg></figure>
    <div class="uses">${G.parts.map(([h, p]) => `<div class="card"><h3>${esc(h)}</h3><p>${esc(p)}</p></div>`).join('')}</div>
    <section class="section"><div class="section-head"><div><h2>${esc(L.d.gDay)}</h2></div></div>
      <div class="steps">${G.day.map(([t, h, p], i) => `<div class="card step"><span class="step-num">${i + 1}</span><div><span class="eyebrow">${esc(t)}</span><h3>${esc(h)}</h3><p>${esc(p)}</p></div></div>`).join('')}</div></section>
    <section class="section"><div class="section-head"><div><h2>${esc(L.d.gTrouble)}</h2></div></div>
      <div class="card table-wrap"><table class="use-table trouble"><thead><tr><th>${esc(L.d.gSee)}</th><th>${esc(L.d.gCause)}</th><th>${esc(L.d.gFix)}</th></tr></thead>
        <tbody>${G.trouble.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>
    <section class="section"><div class="section-head"><div><h2>${esc(L.d.gFaq)}</h2></div></div>
      ${G.faq.map(([q, a]) => `<details class="card method"><summary><span>${esc(q)}</span></summary><p>${esc(a)}</p></details>`).join('')}</section>
    <p class="muted fine">${esc(L.d.honesty)}</p>
  </div>`;
}
