// Livestock & farm books (ported from Farm Manager's React Native screens): overview with "Needs attention",
// animals and their health log, money by month and account, feed and stock with days left, upkeep, vaccinations
// and the photo health check (api/health-check.js). Same data model and the same rules (lib/farmbooks.js).
const B = FFBooks;
const SPECIES_ICON = { goat: 'goat', cow: 'cow', chicken: 'hen' };
const spIcon = sp => icon(SPECIES_ICON[sp] || 'paw');
const fNav = on => subnav([['overview', '#/farm', L.f.nav.overview], ['animals', '#/farm/animals', L.f.nav.animals], ['money', '#/farm/money', L.f.nav.money], ['stock', '#/farm/stock', L.f.nav.stock], ['health', '#/farm/health', L.f.nav.health]], on, L.titles.farm);
const animalName = a => dn(a.name) || a.tag || L.f.one[a.species] || a.species;
const catName = c => L.f.cats[c] || c;
const TONE = { overdue: 'danger', warning: 'warn', due: 'info' };
const REM_ICON = { vaccination: 'syringe', feed: 'leaf', stock: 'box', balance: 'wallet', maintenance: 'wrench', health: 'pulse' };

// One form schema per record type, like Farm Manager's schema.ts; labels come from L.f.fields.
function schema(c) {
  const F = L.f.fields, H = L.f.help, P = L.f.ph;
  const sp = () => B.SPECIES.map(s => [s, L.f.one[s]]);
  const animals = () => [['', L.f.form.pick], ...farm.list('animals').filter(a => !['sold', 'dead'].includes(a.status)).map(a => [a.id, animalName(a)])];
  const S = {
    animals: { defaults: { species: 'goat', status: 'healthy', count: 1 }, fields: [
      { name: 'species', label: F.species, type: 'select', options: sp(), required: true }, { name: 'name', label: F.name, placeholder: P.name }, { name: 'tag', label: F.tag, placeholder: P.tag },
      { name: 'count', label: F.count, type: 'number', min: 1, help: H.count }, { name: 'breed', label: F.breed, placeholder: P.breed },
      { name: 'sex', label: F.sex, type: 'select', options: [['', '—'], ...Object.entries(L.f.sex)] }, { name: 'birthDate', label: F.birthDate, type: 'date' },
      { name: 'weightKg', label: F.weightKg, type: 'number', min: 0, step: 0.1 }, { name: 'status', label: F.status, type: 'select', options: Object.entries(L.f.status) }, { name: 'notes', label: F.notes, type: 'textarea' }] },
    health: { defaults: { kind: 'check', date: todayISO() }, fields: [
      { name: 'animalId', label: F.animalId, type: 'select', options: animals(), required: true }, { name: 'date', label: F.date, type: 'date', required: true },
      { name: 'kind', label: F.kind, type: 'select', options: ['check', 'treatment', 'deworming', 'vet'].map(k => [k, L.f.log[k]]) },
      { name: 'summary', label: F.summary, type: 'textarea', required: true }, { name: 'cost', label: F.cost, type: 'number', min: 0 }] },
    vaccinations: { defaults: {}, fields: [
      { name: 'vaccine', label: F.vaccine, required: true, placeholder: P.vaccine }, { name: 'animalId', label: F.animalId, type: 'select', options: animals(), help: H.vAnimal },
      { name: 'species', label: F.vSpecies, type: 'select', options: [['', '—'], ...sp()] }, { name: 'dueDate', label: F.dueDate, type: 'date', required: true },
      { name: 'givenDate', label: F.givenDate, type: 'date', help: H.givenDate }, { name: 'notes', label: F.notes, type: 'textarea' }] },
    transactions: { defaults: { type: 'expense', date: todayISO() }, fields: [
      { name: 'type', label: F.type, type: 'select', options: Object.entries(L.f.types), required: true }, { name: 'amount', label: F.amount, type: 'number', min: 0, required: true },
      { name: 'category', label: F.category, type: 'select', options: Object.keys(L.f.cats).map(k => [k, L.f.cats[k]]) }, { name: 'date', label: F.date, type: 'date', required: true },
      { name: 'accountId', label: F.accountId, type: 'select', options: farm.list('accounts').map(a => [a.id, dn(a.name)]), help: H.accountId },
      { name: 'species', label: F.txSpecies, type: 'select', options: [['', '—'], ...sp()] }, { name: 'note', label: F.note, type: 'textarea' }] },
    accounts: { defaults: { openingBalance: 0, minBalance: 0 }, fields: [
      { name: 'name', label: F.aName, required: true, placeholder: P.aName }, { name: 'openingBalance', label: F.openingBalance, type: 'number', required: true },
      { name: 'minBalance', label: F.minBalance, type: 'number', min: 0, help: H.minBalance }] },
    inventory: { defaults: { category: 'feed', unit: 'kg' }, fields: [
      { name: 'name', label: F.item, required: true, placeholder: P.item }, { name: 'category', label: F.category, type: 'select', options: Object.entries(L.f.stockCats) },
      { name: 'quantity', label: F.quantity, type: 'number', min: 0, step: 0.1, required: true }, { name: 'unit', label: F.unit, placeholder: P.unit },
      { name: 'minLevel', label: F.minLevel, type: 'number', min: 0, step: 0.1 }, { name: 'dailyUse', label: F.dailyUse, type: 'number', min: 0, step: 0.1, help: H.dailyUse },
      { name: 'unitCost', label: F.unitCost, type: 'number', min: 0, step: 0.1 }] },
    maintenance: { defaults: {}, fields: [
      { name: 'title', label: F.title, required: true, placeholder: P.title }, { name: 'asset', label: F.asset }, { name: 'everyDays', label: F.everyDays, type: 'number', min: 0 },
      { name: 'lastDone', label: F.lastDone, type: 'date' }, { name: 'dueDate', label: F.mDueDate, type: 'date', help: H.mDueDate }, { name: 'cost', label: F.mCost, type: 'number', min: 0 }, { name: 'notes', label: F.notes, type: 'textarea' }] },
  };
  return S[c];
}
const NUMBER_FIELDS = new Set(['count', 'weightKg', 'cost', 'amount', 'openingBalance', 'minBalance', 'quantity', 'minLevel', 'dailyUse', 'unitCost', 'everyDays']);
// Add or edit any record with one form, as Farm Manager's edit/[collection] screen did.
function editRecord(c, id, preset = {}) {
  const sc = schema(c), rec = id ? farm.find(c, id) : null, base = { ...sc.defaults, ...preset, ...(rec || {}) };
  openForm({ title: rec ? L.f.form.editT(L.f.coll[c]) : L.f.form.addT(L.f.coll[c]), fields: sc.fields.map(f => ({ ...f, value: base[f.name] ?? '' })),
    extra: rec ? `<button type="button" class="link danger" id="delRec">${esc(L.common.del)}</button>` : '',
    onSave: d => {
      for (const k in d) if (NUMBER_FIELDS.has(k) && d[k] !== '') d[k] = Number(d[k]);
      if (rec) farm.update(c, id, d); else farm.add(c, d);
      rerender(); toast(L.f.form.saved);
    } });
  $('#delRec')?.addEventListener('click', () => {
    if (!confirmAsk(L.f.form.delQ)) return;
    const r = farm.remove(c, id); formDlg.close();
    if (c === 'animals' && location.hash.startsWith('#/farm/animal/')) location.hash = '#/farm/animals'; else rerender();
    toast(L.f.form.deleted, () => { farm.restore(c, r.gone, r.i); rerender(); });
  });
}

/* ---------- Reminder text, shared with Today ---------- */
function remTitle(r) { return L.att['farm.' + r.kind]({ ...r, item: dn(r.item), task: dn(r.task), account: dn(r.account), animal: dn(r.animal) }); }
function remDetail(r) {
  const D = L.attDetail;
  if (r.kind === 'vaccination' || r.kind === 'maintenance') return r.days < 0 ? D.late(-r.days) : r.days === 0 ? D.dueToday : D.dueIn(r.days);
  if (r.kind === 'feed' || r.kind === 'stock') return r.daysLeft !== null ? D.daysLeft(r.daysLeft) : D.left(nf(r.quantity, 1), r.unit);
  if (r.kind === 'balance') return D.balance(money(r.balance), money(r.minBalance));
  return D.checkTreatment;
}
// The action that settles a reminder right where it shows (Farm Manager's TaskRow).
function remAction(r) {
  if (r.kind === 'vaccination') return `<button class="btn ${r.level === 'overdue' ? 'btn-primary' : 'btn-outline'} sm" data-f="given" data-id="${r.ref.id}">${icon('check')}${esc(L.act.given)}</button>`;
  if (r.kind === 'maintenance') return `<button class="btn ${r.level === 'overdue' ? 'btn-primary' : 'btn-outline'} sm" data-f="done" data-id="${r.ref.id}">${icon('check')}${esc(L.act.done)}</button>`;
  if (r.kind === 'balance') return `<button class="btn btn-outline sm" data-f="income" data-id="${r.ref.id}">${icon('plus')}${esc(L.act.income)}</button>`;
  if (r.kind === 'health') return `<a class="btn btn-outline sm" href="#/farm/animal/${r.ref.id}">${esc(L.act.view)}</a>`;
  return `<button class="btn btn-outline sm" data-f="edit" data-c="inventory" data-id="${r.ref.id}">${icon('plus')}${esc(L.act.restock)}</button>`;
}
function settle(kind, id) {
  const c = kind === 'given' ? 'vaccinations' : 'maintenance', before = { ...farm.find(c, id) };
  const patch = kind === 'given' ? { givenDate: todayISO() } : { lastDone: todayISO(), ...(Number(before.everyDays) ? {} : { dueDate: '' }) };
  farm.update(c, id, patch); rerender();
  toast(kind === 'given' ? L.toastGiven(before.vaccine) : L.toastDone(dn(before.title)), () => {
    const undo = {}; for (const k in patch) undo[k] = before[k] ?? ''; farm.update(c, id, undo); rerender();
  });
}

/* ---------- Overview ---------- */
function viewFarm() {
  const s = B.summary(farm.data, todayISO()), tasks = s.reminders, urgent = tasks.filter(r => r.level !== 'due').length;
  const feeds = B.feedDays(farm.list('inventory'));
  const head = B.SPECIES.reduce((n, sp) => n + (s.livestock[sp]?.head ?? 0), 0), sick = B.SPECIES.reduce((n, sp) => n + (s.livestock[sp]?.sick ?? 0), 0);
  const { income, expense, net } = s.month, low = s.balances.filter(b => b.balance < b.minBalance), scale = Math.max(income, expense, 1);
  return `<div class="fade-in">
    <span class="eyebrow">${esc(L.f.eyebrow)}</span><h1 class="page-title">${esc(L.f.nav.overview)}</h1>
    <p class="page-lede">${esc(new Date().toLocaleDateString(L.locale, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}</p>
    ${fNav('overview')}${sampleNote()}
    <div class="kpis">
      <a class="card kpi" href="#/farm/animals"><small>${icon('paw')}${esc(L.f.kpi.livestock)}</small><b>${nf(head)}</b><span class="${sick ? 'bad' : 'good'}">${esc(sick ? L.f.sick(sick) : L.f.allHealthy)}</span></a>
      <a class="card kpi" href="#/farm/money"><small>${icon('chart')}${esc(L.f.kpi.net)}</small><b class="${net < 0 ? 'bad' : ''}">${money(net)}</b><span>${esc(L.f.inOut(compactMoney(income), compactMoney(expense)))}</span></a>
      <a class="card kpi" href="#/farm/money"><small>${icon('wallet')}${esc(L.f.kpi.balance)}</small><b>${compactMoney(s.totalBalance)}</b><span class="${low.length ? 'bad' : 'good'}">${esc(low.length ? L.f.belowMin(dn(low[0].name)) : L.f.aboveAll)}</span></a>
      <a class="card kpi" href="#/farm/stock"><small>${icon('leaf')}${esc(L.f.kpi.feed)}</small><b class="${feeds.length && feeds[0].days <= 5 ? 'warn' : ''}">${feeds.length ? esc(L.f.days(feeds[0].days)) : '—'}</b><span>${esc(feeds.length ? L.f.runsOut(dn(feeds[0].name)) : L.f.addDaily)}</span></a>
    </div>
    <div class="cols">
      <div class="mini-stack">
        <section class="card panel"><div class="panel-head"><div><h2>${esc(L.f.attn)}</h2><p>${esc(L.f.attnSub(urgent, tasks.length - urgent, tasks.length))}</p></div><a class="link" href="#/farm/health">${esc(L.f.vaccs)}</a></div>
          ${tasks.length ? `<ul class="tasks">${tasks.map(r => `<li class="task ${TONE[r.level]}"><span class="tile">${icon(REM_ICON[r.kind])}</span>
            <div><b>${esc(remTitle(r))}</b><span>${badge(L.f.level[r.level], TONE[r.level])} <small>${esc(remDetail(r))}</small></span></div>${remAction(r)}</li>`).join('')}</ul>`
          : `<p class="empty">${icon('check')} ${esc(L.f.attnNone)}</p>`}</section>
        <section class="card panel"><div class="panel-head"><div><h2>${esc(L.f.feedTitle)}</h2><p>${esc(L.f.feedSub)}</p></div><a class="link" href="#/farm/stock">${esc(L.f.allStock)}</a></div>
          ${feeds.length ? `<ul class="rows bare">${feeds.slice(0, 4).map(f => { const tone = f.days <= 3 ? 'danger' : f.days <= 7 ? 'warn' : 'ok';
            return `<li class="feed-row"><div><b>${esc(dn(f.name))}</b><small>${esc(L.f.perDay(nf(f.quantity), f.unit, nf(f.dailyUse, 1)))}</small></div>${meter(f.days / 21, tone)}<span class="days ${tone}">${esc(L.f.days(f.days))}</span></li>`; }).join('')}</ul>` : `<p class="empty">${esc(L.f.feedNone)}</p>`}</section>
      </div>
      <div class="mini-stack">
        <section class="card panel"><div class="panel-head"><div><h2>${esc(L.f.herd)}</h2></div><a class="link" href="#/farm/animals">${esc(L.f.allAnimals)}</a></div>
          <ul class="rows bare">${B.SPECIES.map(sp => { const n = s.livestock[sp];
            return `<li><a href="#/farm/animals/${sp}"><span class="sp">${spIcon(sp)}</span><b class="grow">${esc(L.f.species[sp])}</b>${n?.sick ? badge(L.f.sick(n.sick), 'danger') : ''}<span class="num">${nf(n?.head ?? 0)}</span></a></li>`; }).join('')}</ul></section>
        <section class="card panel"><div class="panel-head"><div><h2>${esc(L.f.thisMonth)}</h2></div><a class="link" href="#/farm/money">${esc(L.f.nav.money)}</a></div>
          <div class="bars2">${[[L.f.income, income, 'inc'], [L.f.spent, expense, 'exp']].map(([l, v, c]) => `<div><div class="kv"><span>${esc(l)}</span><b>${money(v)}</b></div><span class="meter ${c}"><i style="width:${(v / scale) * 100}%"></i></span></div>`).join('')}</div></section>
        <section class="card panel"><div class="panel-head"><div><h2>${esc(L.f.accounts)}</h2><p>${esc(L.f.total(money(s.totalBalance)))}</p></div></div>
          <ul class="rows bare">${s.balances.map(b => `<li><div class="grow"><b>${esc(dn(b.name))}</b><small>${esc(L.f.minimum(money(b.minBalance)))}</small></div><div class="end"><b class="${b.balance < b.minBalance ? 'bad' : ''}">${money(b.balance)}</b>${b.balance < b.minBalance ? badge(L.f.belowMinimum, 'danger') : ''}</div></li>`).join('')}</ul></section>
      </div>
    </div>
  </div>`;
}

/* ---------- Animals ---------- */
const fState = { q: '' };
function viewFarmAnimals(sp) {
  const list = farm.list('animals');
  return `<div class="fade-in">
    <span class="eyebrow">${esc(L.f.eyebrow)}</span><h1 class="page-title">${esc(L.f.animalsTitle)}</h1><p class="page-lede">${esc(L.f.animalsLede)}</p>
    ${fNav('animals')}
    <div class="list-head"><label class="search">${icon('search')}<input id="aq" type="search" value="${esc(fState.q)}" placeholder="${esc(L.f.searchAnimals)}" aria-label="${esc(L.f.searchAnimals)}" autocomplete="off"></label>
      <button class="btn btn-primary" data-f="edit" data-c="animals" data-preset="${esc(sp || '')}">${icon('plus')}${esc(L.f.addAnimal)}</button></div>
    <div class="chips scroll" id="aSp">${[['', L.f.all], ...B.SPECIES.map(s => [s, `${L.f.species[s]} ${list.filter(a => a.species === s).length}`])].map(([k, v]) =>
      `<a class="chip ${k === (sp || '') ? 'on' : ''}" href="#/farm/animals${k ? '/' + k : ''}">${esc(v)}</a>`).join('')}</div>
    <ul class="card rows" id="aList"></ul>
  </div>`;
}
function bindFarmAnimals(sp) {
  const draw = () => {
    const q = fState.q.trim().toLowerCase();
    const list = farm.list('animals').filter(a => (!sp || a.species === sp) && (!q || [a.name, a.tag, a.breed].some(x => x && String(x).toLowerCase().includes(q))));
    $('#aList').innerHTML = list.map(a => `<li><a href="#/farm/animal/${a.id}"><span class="sp">${spIcon(a.species)}</span><div class="grow"><b>${esc(animalName(a))}</b>
      <small>${esc([a.tag ? '#' + a.tag : '', dn(a.breed), Number(a.count) > 1 ? L.f.head(a.count) : ''].filter(Boolean).join(' · '))}</small></div>
      ${badge(L.f.status[a.status] || a.status, { sick: 'danger', pregnant: 'info', healthy: 'ok' }[a.status] || '')}${icon('next')}</a></li>`).join('') || `<li class="empty">${esc(L.f.noAnimals)}</li>`;
  };
  $('#aq').addEventListener('input', e => { fState.q = e.target.value; draw(); });
  draw();
}
function ageOf(birth) {
  if (!birth) return null;
  const months = Math.floor((Date.now() - Date.parse(birth)) / (30.44 * 864e5));
  if (!Number.isFinite(months) || months < 0) return null;
  return months < 24 ? L.f.months(months) : L.f.years(Math.floor(months / 12));
}
function viewFarmAnimal(id) {
  const a = farm.find('animals', id);
  if (!a) return `<div class="fade-in"><a class="back" href="#/farm/animals">${icon('back')}${esc(L.f.animalsTitle)}</a><h1 class="page-title">${esc(L.f.notFound)}</h1><p class="muted">${esc(L.f.notFoundSub)}</p></div>`;
  const log = farm.list('health').filter(h => h.animalId === id).sort((x, y) => String(y.date).localeCompare(String(x.date)));
  const doses = farm.list('vaccinations').filter(v => v.animalId === id || (!v.animalId && v.species === a.species))
    .sort((x, y) => Number(!!x.givenDate) - Number(!!y.givenDate) || String(x.dueDate).localeCompare(String(y.dueDate)));
  const facts = [[L.f.facts.species, L.f.one[a.species]], [L.f.facts.tag, a.tag ? '#' + a.tag : null], [L.f.facts.breed, dn(a.breed) || null], [L.f.facts.sex, L.f.sex[a.sex] || null],
    [L.f.facts.age, ageOf(a.birthDate)], [L.f.facts.weight, a.weightKg ? `${a.weightKg} kg` : null], [L.f.facts.head, Number(a.count) > 1 ? String(a.count) : null]].filter(([, v]) => v);
  const logIcon = { ai: 'scan', vet: 'syringe', treatment: 'pulse', deworming: 'drop', check: 'check' };
  return `<div class="fade-in">
    <a class="back" href="#/farm/animals">${icon('back')}${esc(L.f.animalsTitle)}</a>
    <div class="title-row"><span class="sp big">${spIcon(a.species)}</span><div class="grow"><span class="eyebrow">${esc(L.f.one[a.species])}</span><h1 class="page-title">${esc(animalName(a))}</h1></div>
      <a class="btn btn-outline sm" href="#/farm/health/${a.id}">${icon('scan')}${esc(L.f.healthCheck)}</a><button class="btn btn-outline sm" data-f="edit" data-c="animals" data-id="${a.id}">${esc(L.common.edit)}</button></div>
    ${a.notes ? `<p class="page-lede">${esc(dn(a.notes))}</p>` : ''}
    <div class="facts">${facts.map(([k, v]) => `<div class="fact"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>
    <div class="chip-row"><span class="muted">${esc(L.f.setStatus)}</span><div class="chips">${Object.entries(L.f.status).map(([k, v]) => `<button type="button" class="chip ${a.status === k ? 'on' : ''}" data-f="status" data-id="${a.id}" data-v="${k}" aria-pressed="${a.status === k}">${esc(v)}</button>`).join('')}</div></div>
    <div class="cols">
      <section class="card panel"><div class="panel-head"><div><h2>${esc(L.f.healthLog)}</h2></div><button class="btn btn-outline sm" data-f="edit" data-c="health" data-preset-animal="${a.id}">${icon('plus')}${esc(L.f.addEntry)}</button></div>
        ${log.length ? `<ul class="rows bare">${log.map(h => `<li><span class="tile">${icon(logIcon[h.kind] || 'check')}</span><div class="grow"><b>${esc(L.f.log[h.kind] || h.kind)}</b><small>${esc(shortDate(h.date))}${h.cost ? ' · ' + money(Number(h.cost)) : ''}</small><p>${esc(dn(h.summary))}</p></div></li>`).join('')}</ul>` : `<p class="empty">${esc(L.f.noLog)}</p>`}</section>
      <section class="card panel"><div class="panel-head"><div><h2>${esc(L.f.vaccs)}</h2></div><button class="btn btn-outline sm" data-f="edit" data-c="vaccinations" data-preset-animal="${a.id}">${icon('plus')}${esc(L.f.addVacc)}</button></div>
        ${doses.length ? `<ul class="rows bare">${doses.map(v => `<li><span class="tile">${icon('syringe')}</span><div class="grow"><b>${esc(v.vaccine)}</b><small>${esc(v.givenDate ? L.f.given(shortDate(v.givenDate)) : L.f.due(shortDate(v.dueDate)))}${!v.animalId ? ' · ' + esc(L.f.forAll(L.f.species[v.species] || '')) : ''}</small></div>
          ${v.givenDate ? badge(L.f.givenList, 'ok') : `<button class="btn btn-outline sm" data-f="given" data-id="${v.id}">${esc(L.f.markGiven)}</button>`}</li>`).join('')}</ul>` : `<p class="empty">${esc(L.f.noVacc)}</p>`}</section>
    </div>
  </div>`;
}

/* ---------- Money ---------- */
const monthKey = d => FFFarm.localISO(d).slice(0, 7);
const ymName = (m, long) => new Date(`${m}-01T00:00:00`).toLocaleDateString(L.locale, long ? { month: 'long', year: 'numeric' } : { month: 'short' });
const fMoney = { type: 'all', month: monthKey(new Date()) };
function viewFarmMoney() {
  const tx = farm.list('transactions'), amt = r => Number(r.amount) || 0;
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i)); return monthKey(d); });
  const data = months.map(m => { const inM = tx.filter(r => String(r.date).startsWith(m)); return { m, inc: inM.filter(r => r.type === 'income').reduce((s, r) => s + amt(r), 0), exp: inM.filter(r => r.type !== 'income').reduce((s, r) => s + amt(r), 0) }; });
  const max = Math.max(1, ...data.flatMap(d => [d.inc, d.exp])), sel = fMoney.month;
  const inMonth = tx.filter(r => !sel || String(r.date).startsWith(sel));
  const rows = inMonth.filter(r => fMoney.type === 'all' || r.type === fMoney.type).sort((a, b) => String(b.date).localeCompare(String(a.date)));
  const inc = inMonth.filter(r => r.type === 'income').reduce((s, r) => s + amt(r), 0), exp = inMonth.filter(r => r.type !== 'income').reduce((s, r) => s + amt(r), 0);
  const byCat = Object.entries(inMonth.filter(r => r.type !== 'income').reduce((m, r) => { const k = r.category || 'Other'; m[k] = (m[k] || 0) + amt(r); return m; }, {})).sort((a, b) => b[1] - a[1]);
  const accounts = B.accountBalances(farm.list('accounts'), tx), accName = new Map(accounts.map(a => [a.id, dn(a.name)]));
  return `<div class="fade-in">
    <span class="eyebrow">${esc(L.f.eyebrow)}</span><h1 class="page-title">${esc(L.f.moneyTitle)}</h1><p class="page-lede">${esc(L.f.moneyLede)}</p>
    ${fNav('money')}
    <div class="list-head"><span></span><button class="btn btn-primary" data-f="edit" data-c="transactions">${icon('plus')}${esc(L.f.addTx)}</button></div>
    <section class="card chart-card"><div class="panel-head"><h2>${esc(L.f.six)}</h2><div class="legend"><span><i class="k-inc"></i>${esc(L.f.income)}</span><span><i class="k-exp"></i>${esc(L.f.spent)}</span></div></div>
      <div class="mchart">${data.map(d => { const on = d.m === sel;
        return `<button type="button" class="mcol ${on ? 'on' : ''} ${sel && !on ? 'dim' : ''}" data-f="month" data-v="${d.m}" aria-pressed="${on}" aria-label="${esc(L.f.chartAria(ymName(d.m, true), money(d.inc), money(d.exp)))}">
          <span class="mbars"><i class="inc" style="height:${Math.max(2, (d.inc / max) * 140)}px"></i><i class="exp" style="height:${Math.max(2, (d.exp / max) * 140)}px"></i></span><span class="ml">${esc(ymName(d.m))}</span></button>`; }).join('')}</div></section>
    <div class="cols">
      <section class="section"><div class="section-head"><div><h2>${esc(sel ? ymName(sel, true) : L.f.allTx)}</h2>
        <p>${esc(L.f.in)} <b class="inc-t">${money(inc)}</b> · ${esc(L.f.out)} <b class="exp-t">${money(exp)}</b>${sel ? ` · <button class="link" data-f="month" data-v="">${esc(L.f.allMonths)}</button>` : ''}</p></div>
        <div class="seg" role="group">${[['all', L.f.all], ['income', L.f.in], ['expense', L.f.out]].map(([k, v]) => `<button type="button" data-f="txtype" data-v="${k}" class="${fMoney.type === k ? 'on' : ''}" aria-pressed="${fMoney.type === k}">${esc(v)}</button>`).join('')}</div></div>
        ${rows.length ? `<ul class="card rows">${rows.map(r => { const inn = r.type === 'income';
          return `<li><button type="button" data-f="edit" data-c="transactions" data-id="${r.id}"><span class="tile ${inn ? 'inc' : 'exp'}">${icon(inn ? 'down' : 'up')}</span><div class="grow"><b>${esc(catName(r.category || (inn ? 'Other' : 'Other')))}${r.species ? ' · ' + esc(L.f.one[r.species] || '') : ''}</b>
            <small>${esc([shortDate(r.date), accName.get(r.accountId), r.note].filter(Boolean).join(' · '))}</small></div><b class="${inn ? 'inc-t' : ''}">${inn ? '+' : '−'}${money(Number(r.amount) || 0).replace('−', '')}</b></button></li>`; }).join('')}</ul>`
          : `<div class="card empty-card"><b>${esc(L.f.nothing)}</b><p>${esc(L.f.nothingSub)}</p></div>`}
      </section>
      <div class="mini-stack">
        ${byCat.length ? `<section class="card panel"><div class="panel-head"><h2>${esc(L.f.byCat)}</h2></div><ul class="rows bare">${byCat.map(([k, v]) => `<li><div class="grow"><b>${esc(catName(k))}</b>${meter(v / byCat[0][1], 'exp')}</div><b>${money(v)}</b></li>`).join('')}</ul></section>` : ''}
        <section class="card panel"><div class="panel-head"><h2>${esc(L.f.accounts)}</h2><button class="btn btn-outline sm" data-f="edit" data-c="accounts">${icon('plus')}${esc(L.f.addAccount)}</button></div>
          <ul class="rows bare">${accounts.map(b => `<li><button type="button" data-f="edit" data-c="accounts" data-id="${b.id}"><div class="grow"><b>${esc(dn(b.name))}</b><small>${esc(L.f.minimum(money(b.minBalance)))}</small></div><b class="${b.balance < b.minBalance ? 'bad' : ''}">${money(b.balance)}</b></button></li>`).join('')}</ul></section>
      </div>
    </div>
  </div>`;
}

/* ---------- Feed & stock, upkeep ---------- */
function viewFarmStock() {
  const inv = farm.list('inventory'), cats = Object.keys(L.f.stockCats);
  const tasks = farm.list('maintenance').map(t => ({ t, due: B.maintenanceDue(t) })).sort((a, b) => String(a.due || '9').localeCompare(String(b.due || '9')));
  return `<div class="fade-in">
    <span class="eyebrow">${esc(L.f.eyebrow)}</span><h1 class="page-title">${esc(L.f.stockTitle)}</h1><p class="page-lede">${esc(L.f.stockLede)}</p>
    ${fNav('stock')}
    <div class="list-head"><span></span><button class="btn btn-primary" data-f="edit" data-c="inventory">${icon('plus')}${esc(L.f.addItem)}</button></div>
    ${cats.filter(c => inv.some(i => (i.category || 'other') === c)).map(c => `<section class="section first-tight"><div class="section-head"><div><h2>${esc(L.f.stockCats[c])}</h2></div></div>
      <ul class="card rows">${inv.filter(i => (i.category || 'other') === c).map(i => { const s = B.stockLevel(i), tone = s.daysLeft == null ? (s.low ? 'warn' : 'ok') : s.daysLeft <= 3 ? 'danger' : s.daysLeft <= 7 ? 'warn' : 'ok';
        return `<li><button type="button" data-f="edit" data-c="inventory" data-id="${i.id}"><div class="grow"><b>${esc(dn(i.name))}</b><small>${esc(i.dailyUse ? L.f.perDay(nf(s.quantity, 1), i.unit || '', nf(i.dailyUse, 1)) : `${nf(s.quantity, 1)} ${i.unit || ''}`)}</small>
          ${s.daysLeft != null ? meter(s.daysLeft / 21, tone) : ''}</div><span class="days ${tone}">${esc(s.daysLeft != null ? L.f.daysLeft(s.daysLeft) : s.low ? L.f.low : '')}</span></button></li>`; }).join('')}</ul></section>`).join('')}
    <section class="section"><div class="section-head"><div><h2>${esc(L.f.upkeep)}</h2><p>${esc(L.f.upkeepSub)}</p></div><button class="btn btn-outline" data-f="edit" data-c="maintenance">${icon('plus')}${esc(L.f.addTask)}</button></div>
      <ul class="card rows">${tasks.map(({ t, due }) => { const d = due ? B.daysBetween(todayISO(), due) : null;
        return `<li><span class="tile">${icon('wrench')}</span><div class="grow"><b>${esc(dn(t.title))}</b><small>${esc([dn(t.asset), Number(t.everyDays) ? L.f.every(t.everyDays) : '', due ? L.f.nextDue(shortDate(due)) : '', t.lastDone ? L.f.lastDone(shortDate(t.lastDone)) : ''].filter(Boolean).join(' · '))}</small></div>
          ${d != null && d <= 7 ? badge(d < 0 ? L.attDetail.late(-d) : d === 0 ? L.attDetail.dueToday : L.attDetail.dueIn(d), d < 0 ? 'danger' : 'info') : ''}
          <button class="btn btn-outline sm" data-f="done" data-id="${t.id}">${esc(L.f.markDone)}</button><button type="button" class="icon-btn" data-f="edit" data-c="maintenance" data-id="${t.id}" aria-label="${esc(L.common.edit)}">${icon('edit')}</button></li>`; }).join('')}</ul></section>
  </div>`;
}

/* ---------- Health: vaccinations and the photo check ---------- */
const hc = { animalId: '', species: '', notes: '', photo: null, busy: false, result: null, error: '', saved: '' };
function viewFarmHealth(animalId) {
  if (animalId && animalId !== hc.animalId) Object.assign(hc, { animalId, result: null, error: '', saved: '' });
  const vacc = farm.list('vaccinations'), animals = new Map(farm.list('animals').map(a => [a.id, a]));
  const who = v => (v.animalId && animals.get(v.animalId) ? animalName(animals.get(v.animalId)) : L.f.forAll(L.f.species[v.species] || ''));
  const open = vacc.filter(v => !v.givenDate).sort((a, b) => String(a.dueDate).localeCompare(String(b.dueDate)));
  const done = vacc.filter(v => v.givenDate).sort((a, b) => String(b.givenDate).localeCompare(String(a.givenDate)));
  const live = farm.list('animals').filter(a => !['sold', 'dead'].includes(a.status));
  return `<div class="fade-in">
    <span class="eyebrow">${esc(L.f.eyebrow)}</span><h1 class="page-title">${esc(L.f.healthTitle)}</h1><p class="page-lede">${esc(L.f.healthLede)}</p>
    ${fNav('health')}
    <div class="org-layout">
      <section class="card panel hc" id="hc">
        <div class="panel-head"><div><h2>${esc(L.f.hc.title)}</h2><p>${esc(L.f.hc.lede)}</p></div></div>
        <div class="hc-body">
          <span class="field-label">${esc(L.f.hc.which)}</span>
          <div class="chips scroll" id="hcAnimals">${[['', L.f.hc.notListed], ...live.map(a => [a.id, animalName(a)])].map(([k, v]) => `<button type="button" class="chip ${hc.animalId === k ? 'on' : ''}" data-hc-animal="${k}" aria-pressed="${hc.animalId === k}">${esc(v)}</button>`).join('')}</div>
          ${!hc.animalId ? `<div class="chips" id="hcSpecies">${B.SPECIES.map(s => `<button type="button" class="chip ${hc.species === s ? 'on' : ''}" data-hc-species="${s}" aria-pressed="${hc.species === s}">${spIcon(s)}${esc(L.f.one[s])}</button>`).join('')}</div>` : ''}
          <label class="field"><span>${esc(L.f.hc.notes)}</span><textarea id="hcNotes" rows="2" placeholder="${esc(L.f.hc.notesPh)}">${esc(hc.notes)}</textarea></label>
          <label class="btn btn-outline file-btn">${icon('camera')}<span>${esc(hc.photo ? L.f.hc.change : L.f.hc.take)}</span><input type="file" accept="image/*" capture="environment" id="hcFile" hidden></label>
          ${hc.photo ? `<figure class="hc-photo"><img src="${hc.photo.url}" alt=""></figure><button class="btn btn-primary wide" id="hcRun" ${hc.busy ? 'disabled' : ''}>${icon('scan')}${esc(hc.busy ? L.f.hc.checking : L.f.hc.check)}</button>` : ''}
          ${hc.error ? `<p class="note bad">${icon('alert')}<span>${esc(hc.error)}</span></p>` : ''}
          <div id="hcResult" aria-live="polite">${hc.result ? assessmentCard(hc.result) : ''}</div>
          <p class="muted fine">${esc(L.f.hc.caveat)}</p>
        </div>
      </section>
      <div class="mini-stack">
        <section class="card panel"><div class="panel-head"><div><h2>${esc(L.f.upcoming)}</h2></div><button class="btn btn-outline sm" data-f="edit" data-c="vaccinations">${icon('plus')}${esc(L.f.addVacc)}</button></div>
          ${open.length ? `<ul class="rows bare">${open.map(v => { const d = B.daysBetween(todayISO(), v.dueDate);
            return `<li><span class="tile">${icon('syringe')}</span><div class="grow"><b>${esc(v.vaccine)} · ${esc(who(v))}</b><small>${esc(L.f.due(shortDate(v.dueDate)))}</small></div>
              ${d <= 7 ? badge(d < 0 ? L.attDetail.late(-d) : d === 0 ? L.attDetail.dueToday : L.attDetail.dueIn(d), d < 0 ? 'danger' : 'info') : ''}<button class="btn btn-outline sm" data-f="given" data-id="${v.id}">${esc(L.f.markGiven)}</button></li>`; }).join('')}</ul>` : `<p class="empty">${esc(L.f.noVacc)}</p>`}</section>
        ${done.length ? `<section class="card panel"><div class="panel-head"><h2>${esc(L.f.givenList)}</h2></div><ul class="rows bare">${done.slice(0, 12).map(v => `<li><span class="tile ok">${icon('check')}</span><div class="grow"><b>${esc(v.vaccine)} · ${esc(who(v))}</b><small>${esc(L.f.given(shortDate(v.givenDate)))}</small></div></li>`).join('')}</ul></section>` : ''}
      </div>
    </div>
  </div>`;
}
function assessmentCard(r) {
  const H = L.f.hc, tone = { looks_healthy: 'ok', possible_concern: 'warn', likely_sick: 'danger', urgent: 'danger' }[r.status] || 'info';
  const list = (t, a) => (a && a.length ? `<h3>${esc(t)}</h3><ul>${a.map(x => `<li>${esc(typeof x === 'string' ? x : `${x.sign}${x.where ? ' · ' + x.where : ''}`)}</li>`).join('')}</ul>` : '');
  return `<div class="card assess ${tone}">
    ${r.demo ? `<p class="note info">${icon('alert')}<span>${esc(H.demo)}</span></p>` : ''}
    <div class="assess-head">${badge(H.status[r.status] || r.status, tone)}<small>${esc(H.confidence(H.conf[r.confidence] || r.confidence))}</small>${r.callVet ? badge(H.callVet, 'danger') : ''}</div>
    <p class="assess-sum">${esc(r.summary)}</p>
    ${list(H.signs, r.signs)}${list(H.conditions, r.possibleConditions)}${list(H.advice, r.advice)}
    ${hc.saved ? `<p class="muted">${esc(hc.saved)}</p>` : ''}
  </div>`;
}
// Shrink the photo in the browser (1024 px JPEG) so the upload stays small on a phone connection.
function shrinkPhoto(file) {
  return new Promise((ok, fail) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 1024 / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL('image/jpeg', 0.8); URL.revokeObjectURL(url);
      ok({ url: data, base64: data.split(',')[1], mediaType: 'image/jpeg' });
    };
    img.onerror = () => { URL.revokeObjectURL(url); fail(new Error('read')); };
    img.src = url;
  });
}
const HC_API = /vercel\.app$|localhost|127\.0\.0\.1/.test(location.hostname) && location.port !== '5240' ? '' : 'https://farmerfriend.vercel.app';
function bindFarmHealth() {
  const el = $('#hc'); if (!el) return;
  el.addEventListener('click', e => {
    const a = e.target.closest('[data-hc-animal]'), s = e.target.closest('[data-hc-species]');
    if (a) { hc.animalId = a.dataset.hcAnimal; rerender(); }
    if (s) { hc.species = hc.species === s.dataset.hcSpecies ? '' : s.dataset.hcSpecies; rerender(); }
  });
  $('#hcNotes').addEventListener('input', e => { hc.notes = e.target.value; });
  $('#hcFile').addEventListener('change', async e => {
    const f = e.target.files[0]; if (!f) return;
    try { hc.photo = await shrinkPhoto(f); hc.result = null; hc.error = ''; hc.saved = ''; } catch { hc.error = L.f.hc.fail; }
    rerender();
  });
  $('#hcRun')?.addEventListener('click', async () => {
    if (!hc.photo || hc.busy) return;
    const animal = farm.find('animals', hc.animalId);
    hc.busy = true; hc.error = ''; rerender();
    try {
      const r = await fetch(HC_API + '/api/health-check', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: hc.photo.base64, mediaType: hc.photo.mediaType, species: animal?.species || hc.species || undefined, notes: hc.notes || undefined, lang: LANG }) });
      if (r.status === 413) throw new Error(L.f.hc.tooBig);
      if (r.status === 429) throw new Error(L.f.hc.busy);
      if (!r.ok) throw new Error(L.f.hc.fail);
      const out = await r.json();
      hc.result = out.result; hc.saved = '';
      // Save it to the animal's health log, and mark it sick when the check says so (as Farm Manager's server did).
      if (animal && !out.result.demo) {
        farm.add('health', { animalId: animal.id, date: todayISO(), kind: 'ai', summary: out.result.summary, result: out.result.status });
        const sick = ['likely_sick', 'urgent'].includes(out.result.status);
        if (sick) farm.update('animals', animal.id, { status: 'sick' });
        hc.saved = sick ? L.f.hc.savedSick(animalName(animal)) : L.f.hc.saved(animalName(animal));
      }
    } catch (e) { hc.error = navigator.onLine === false ? L.f.hc.offline : (e.message && !/fetch/i.test(e.message) ? e.message : L.f.hc.fail); }
    hc.busy = false; rerender();
  });
}

document.addEventListener('click', e => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  const act = b.dataset.f, id = b.dataset.id;
  if (act === 'edit') {
    const preset = {};
    if (b.dataset.presetAnimal) preset.animalId = b.dataset.presetAnimal;
    if (b.dataset.c === 'animals' && b.dataset.preset) preset.species = b.dataset.preset;
    editRecord(b.dataset.c, id, preset);
  }
  else if (act === 'given' || act === 'done') settle(act, id);
  else if (act === 'income') editRecord('transactions', null, { type: 'income', accountId: id, category: 'Milk' });
  else if (act === 'status') { const a = farm.find('animals', id), prev = a.status; farm.update('animals', id, { status: b.dataset.v }); rerender();
    toast(L.f.marked(animalName(a), L.f.status[b.dataset.v]), () => { farm.update('animals', id, { status: prev }); rerender(); }); }
  else if (act === 'month') { fMoney.month = fMoney.month === b.dataset.v ? '' : b.dataset.v; rerender(); }
  else if (act === 'txtype') { fMoney.type = b.dataset.v; rerender(); }
});
