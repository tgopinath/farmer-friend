// "Today on your farm": the weather and its advice, one ranked list of what needs attention across
// Water, Farm, Drying and Crops, a glance at each section, then this month's sowing and harvest.
function attnRow(x) {
  const D = L.attDetail, sec = `<span class="sec-tag ${x.section}">${esc(L.section[x.section])}</span>`;
  let title = '', detail = '', action = '', ic = 'check';
  if (x.section === 'farm') {
    const r = x.item; title = remTitle(r); detail = remDetail(r); action = remAction(r); ic = REM_ICON[r.kind];
  } else if (x.section === 'water' && x.kind === 'water.rain') {
    title = L.att['water.rain'](nf(x.item.rain), relDay(x.item.date, true)); detail = D.recharge; ic = 'rain';
    action = `<a class="btn btn-outline sm" href="#/water/rain">${esc(L.act.rain)}</a>`;
  } else if (x.section === 'water') {
    const a = x.item.advice, f = x.item.field, s = wSource(f.sourceId);
    title = L.att[x.kind]({ ...x.item, field: { ...f, name: dn(f.name) } }); ic = x.kind === 'water.hold' ? 'rain' : 'drop';
    detail = x.kind === 'water.hold' ? D.rainSoon(Math.round(a.rainSoon)) : D.give(litres(a.amount.litres), a.amount.minutes && s ? dur(a.amount.minutes) : '');
    action = `<a class="btn ${x.level === 'now' ? 'btn-primary' : 'btn-outline'} sm" href="#/water/field/${f.id}">${esc(L.act.water)}</a>`;
  } else if (x.section === 'drying') {
    const d = x.item; title = L.att[x.kind](); ic = x.kind === 'drying.rain' ? 'rain' : 'sun';
    detail = x.kind === 'drying.rain' ? D.rainChance(d.rain) : D.inside(nf(d.house), nf(d.houseRH));
    action = `<a class="btn btn-outline sm" href="#/drying">${esc(L.act.drying)}</a>`;
  } else if (x.section === 'crops') {
    title = L.att[x.kind](x.item.n); ic = x.kind === 'crops.sow' ? 'sprout' : 'leaf';
    detail = x.kind === 'crops.sow' ? D.sowLink : D.harvestLink;
    action = `<a class="btn btn-outline sm" href="#/seasons/month/${nowMonth()}">${esc(L.act.crops)}</a>`;
  }
  const tone = { now: 'danger', soon: 'warn', week: 'info', info: 'ok' }[x.level];
  return `<li class="task ${tone}"><span class="tile">${icon(ic)}</span><div><b>${esc(title)}</b><span>${sec}${badge(L.level[x.level], tone)} <small>${esc(detail)}</small></span></div>${action}</li>`;
}

function viewToday() {
  const m = nowMonth(), s = seasonFor(m), S = SEASONS[s];
  const sowNow = CROPS.filter(c => c.sow.includes(m)), harvestNow = CROPS.filter(c => c.harvest.includes(m));
  const nextM = m % 12 + 1, sowNext = CROPS.filter(c => c.sow.includes(nextM) && !c.sow.includes(m));
  return `
    <form class="search home-search" id="homeSearch" role="search">${icon('search')}<input id="hq" type="search" placeholder="${esc(L.homeSearchPh)}" autocomplete="off" aria-label="${esc(L.homeSearchPh)}"></form>
    <div class="fade-in">
      <span class="eyebrow">${esc(new Date().toLocaleDateString(L.locale, { weekday: 'long', day: 'numeric', month: 'long' }))}</span>
      <h1 class="page-title">${esc(L.todayTitle)}</h1>
      ${sampleNote()}
      <div class="hero">
        <section class="card attn" id="attn"><div class="skeleton" style="height:180px"></div></section>
        <section class="card weather" id="weather" aria-live="polite"><div class="skeleton" style="height:56px"></div><div class="skeleton" style="height:76px"></div><div class="skeleton" style="height:60px"></div></section>
      </div>
      <div class="glance" id="glance"></div>
      <section class="season-card slim ${s}">
        <span class="season-art">${icon(s === 'kharif' ? 'rain' : s === 'rabi' ? 'leaf' : 'sun')}</span>
        <h2>${L.seasonHeading[s]}</h2>
        <p>${LANG === 'ta' ? '' : `<span class="ta">${S.ta} · </span>`}${S.months}. ${S.about}</p>
        <div class="actions"><a class="btn btn-light" href="#/seasons/${s}">${icon('calendar')}${L.seasonPlanner}</a><a class="btn btn-ghost" href="#/crops">${icon('leaf')}${L.allCrops}</a></div>
      </section>
      <section class="section">
        <div class="section-head"><div><h2>${L.sowIn(monthName(m))}</h2><p>${L.cropsThisMonth(sowNow.length)}</p></div><a class="link" href="#/seasons/month/${m}">${L.monthPlanner}${icon('next')}</a></div>
        <div class="rail">${sowNow.map(cropCard).join('')}</div>
      </section>
      ${harvestNow.length ? `<section class="section"><div class="section-head"><div><h2>${L.readyHarvest}</h2><p>${L.harvestedIn(monthName(m))}</p></div></div><div class="mini-list">${harvestNow.map(miniRow).join('')}</div></section>` : ''}
      ${sowNext.length ? `<section class="section"><div class="section-head"><div><h2>${L.getReady(monthName(nextM))}</h2><p>${L.getReadySub}</p></div></div><div class="mini-list">${sowNext.map(miniRow).join('')}</div></section>` : ''}
      <section class="section"><div class="section-head"><div><h2>${L.makeOnFarm}</h2><p>${L.makeOnFarmSub}</p></div><a class="link" href="#/organic">${L.seeAll(COMPOSTS.length)}${icon('next')}</a></div>
        <div class="org-grid">${['jeevamrutham', 'vermicompost', 'neemastra'].map(inputById).map(orgCard).join('')}</div></section>
      ${disclaimerHtml()}
    </div>`;
}

function bindToday() {
  bindHomeSearch();
  const m = nowMonth();
  const sowN = CROPS.filter(c => c.sow.includes(m)).length, harvestN = CROPS.filter(c => c.harvest.includes(m)).length;
  withWeather((w, failed) => {
    const el = $('#weather'); if (!el) return;
    if (w) renderWeather(el, FFWx.ahead(w.d, 5), place());
    else if (failed) el.innerHTML = `<div class="weather-top"><span class="weather-icon">${icon('cloud')}</span><div><b>${L.wxFail}</b><p class="muted" style="font-size:14px">${L.wxFailSub}</p></div></div>`;
    const wd = wxDays.water(w), dd = wxDays.dry(w), adv = waterAdvice(wd), books = B.summary(farm.data, todayISO());
    const items = FFAttention.rank([
      ...FFAttention.fromFarm(books.reminders), ...FFAttention.fromWater(adv), ...FFAttention.fromRain(wd.length ? W.rainOutlook(wd) : null),
      ...FFAttention.fromDrying(dd), ...FFAttention.fromCrops(sowN, harvestN, todayISO()),
    ]);
    const n = FFAttention.counts(items);
    $('#attn').innerHTML = `<div class="panel-head"><div><h2>${esc(L.attnTitle)}</h2><p>${esc(L.attnSub(n.now || 0, n.soon || 0, n.week || 0))}</p></div></div>
      ${items.some(x => x.level !== 'info') ? '' : `<p class="empty">${icon('check')} ${esc(L.attnNone)}</p>`}
      <ul class="tasks">${items.slice(0, 9).map(attnRow).join('')}</ul>`;
    const due = adv.filter(x => x.advice && ['water', 'urgent'].includes(x.advice.key)), dueL = due.reduce((s, x) => s + x.advice.amount.litres, 0);
    const head = B.SPECIES.reduce((t, sp) => t + (books.livestock[sp]?.head ?? 0), 0), sick = B.SPECIES.reduce((t, sp) => t + (books.livestock[sp]?.sick ?? 0), 0);
    $('#glance').innerHTML = [
      ['water', '#/water', 'drop', wd.length ? L.glanceWater(due.length, litres(dueL)) : L.w.fetching, `${farm.list('fields').length} · ${L.w.fieldsTitle}`],
      ['drying', '#/drying', 'sun', dd.length ? L.glanceDry(FFWx.rating(dd[0].f)) : L.w.fetching, dd.length ? L.attDetail.inside(nf(dd[0].house), nf(dd[0].houseRH)) : ''],
      ['farm', '#/farm', 'paw', L.glanceFarm(nf(head), sick), L.glanceNet(money(books.month.net))],
    ].map(([k, href, ic, a, b]) => `<a class="card glance-card ${k}" href="${href}"><span class="org-icon">${icon(ic)}</span><div><span class="eyebrow">${esc(L.glance[k])}</span><b>${esc(a)}</b><small>${esc(b)}</small></div>${icon('next')}</a>`).join('');
  });
}

/* ---------- Settings ---------- */
function viewSettings() {
  const p = place(), d = farm.data;
  return `<div class="fade-in">
    <h1 class="page-title">${esc(L.s.title)}</h1><p class="page-lede">${esc(L.s.lede)}</p>
    <div class="settings">
      <section class="card panel"><div class="panel-head"><div><h2>${esc(L.s.place)}</h2><p>${esc(L.s.placeSub)}</p></div></div>
        <div class="set-row">${icon('pin')}<b class="grow">${esc(p.mine ? L.myFarm : p.name)}${p.admin ? `<small>${esc(p.admin)}</small>` : ''}</b><button class="btn btn-outline sm" data-s="place">${esc(L.s.change)}</button></div>
        <p class="muted fine">${esc(L.s.geoNote)}</p></section>
      <section class="card panel"><div class="panel-head"><div><h2>${esc(L.s.lang)}</h2></div></div>
        <div class="seg" role="group" aria-label="${esc(L.s.lang)}"><button type="button" data-s="lang" data-v="en" class="${LANG === 'en' ? 'on' : ''}" aria-pressed="${LANG === 'en'}" lang="en">English</button><button type="button" data-s="lang" data-v="ta" class="${LANG === 'ta' ? 'on' : ''}" aria-pressed="${LANG === 'ta'}" lang="ta">தமிழ்</button></div></section>
      <section class="card panel"><div class="panel-head"><div><h2>${esc(L.s.profile)}</h2><p>${esc(L.s.profileLine(d.fields.length, d.sources.length, d.animals.length))}</p></div></div>
        <ul class="rows bare">
          <li><a href="#/water/fields"><span class="tile">${icon('drop')}</span><b class="grow">${esc(L.s.fields)} · ${esc(L.s.sources)}</b>${icon('next')}</a></li>
          <li><a href="#/farm/animals"><span class="tile">${icon('paw')}</span><b class="grow">${esc(L.s.animals)}</b>${icon('next')}</a></li>
          <li><a href="#/farm/money"><span class="tile">${icon('wallet')}</span><b class="grow">${esc(L.f.accounts)}</b>${icon('next')}</a></li>
        </ul></section>
      <section class="card panel"><div class="panel-head"><div><h2>${esc(L.s.data)}</h2><p>${esc(L.s.dataSub)}</p></div></div>
        <div class="row-btns"><button class="btn btn-outline" data-s="export">${esc(L.s.exportB)}</button>
          <label class="btn btn-outline">${esc(L.s.importB)}<input type="file" accept="application/json" data-s-import hidden></label>
          <button class="btn btn-outline" data-s="sample">${esc(L.s.sampleB)}</button><button class="btn btn-ghost danger" data-s="empty">${esc(L.s.emptyB)}</button></div></section>
      <section class="card panel"><div class="panel-head"><div><h2>${esc(L.s.about)}</h2></div></div><p>${esc(L.s.aboutText)}</p>
        <div class="row-btns"><a class="btn btn-outline" href="#/sources">${icon('check')}${esc(L.s.report)}</a></div></section>
    </div>
  </div>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-s]'); if (!b) return;
  const act = b.dataset.s;
  if (act === 'place') $('#placeBtn').click();
  else if (act === 'lang' && b.dataset.v !== LANG) $('#langBtn').click();
  else if (act === 'export') download(`farmerfriend-${todayISO()}.json`, farm.exportJSON());
  else if (act === 'sample') { if (confirmAsk(L.s.sampleQ)) { farm.reset('sample'); rerender(); } }
  else if (act === 'empty') { if (confirmAsk(L.s.emptyQ)) { farm.reset('empty'); rerender(); } }
});
document.addEventListener('change', async e => {
  if (!e.target.matches('[data-s-import]') || !e.target.files[0]) return;
  try { const d = JSON.parse(await e.target.files[0].text()); if (!d || !Array.isArray(d.fields) || !Array.isArray(d.animals)) throw 0; farm.replace({ ...d, sample: false }); rerender(); toast(L.s.imported); }
  catch { toast(L.s.badFile); }
});
