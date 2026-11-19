// Shared pieces for every section: the one weather fetch, the one farm profile, number and date
// formatting in the current language, the section sub-navigation, a form dialog and an undo toast.
// Loaded after app.js (which defines $, esc, icon, store, L, LANG, place).

/* ---------- One farm profile ---------- */
const farm = FFFarm.create((() => { try { return localStorage; } catch { return null; } })());
const todayISO = () => FFFarm.localISO();
// Sample-farm names in the current language (your own entries show exactly as typed).
const dn = s => (s && L.sampleText && L.sampleText[s]) || s;

/* ---------- One weather fetch ---------- */
// Cached per place for 30 minutes; a stale copy is shown while a fresh one loads, and offline.
let WXD = null, wxLoading = null;
const wxKey = p => 'wx2.' + p.lat + ',' + p.lon;
function weatherNow() {
  const p = place();
  if (!WXD || WXD.key !== wxKey(p)) { const c = store.get(wxKey(p), null); WXD = c && c.d ? { key: wxKey(p), ...c } : null; }
  return WXD;
}
async function fetchWeather(force) {
  const p = place(), key = wxKey(p), have = weatherNow();
  if (!force && have && Date.now() - have.t < 30 * 60e3) return have;
  if (wxLoading) return wxLoading;
  wxLoading = fetch(FFWx.url(p)).then(r => { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
    .then(d => { const rec = { t: Date.now(), d }; store.set(key, rec); WXD = { key, ...rec }; return WXD; })
    .catch(e => { if (WXD) { WXD.error = String(e.message || e); return WXD; } throw e; })
    .finally(() => { wxLoading = null; });
  return wxLoading;
}
// Run `draw` now with whatever weather there is, and again when a fresh reply arrives (if still on the same page).
function withWeather(draw) {
  const h = location.hash, w = weatherNow();
  draw(w);
  if (!w || Date.now() - w.t > 30 * 60e3) fetchWeather().then(nw => { if (location.hash === h && nw !== w) draw(nw); }).catch(() => { if (location.hash === h && !w) draw(null, true); });
}
const wxDays = { water: w => (w ? FFWx.waterDays(w.d) : []), dry: w => (w ? FFWx.dryDays(w.d) : []) };

/* ---------- Formatting ---------- */
const nf = (n, d = 0) => Number(n || 0).toLocaleString(L.locale, { maximumFractionDigits: d, minimumFractionDigits: d });
const litres = l => (LANG === 'ta'
  ? (l >= 100000 ? `${nf(l / 100000, 1)} லட்சம் L` : `${nf(Math.round(l / 10) * 10)} L`)
  : (l >= 100000 ? `${nf(l / 100000, 1)} lakh L` : `${nf(Math.round(l / 10) * 10)} L`));
const dur = m => {
  if (m == null) return '—';
  const h = Math.floor(m / 60), mm = Math.round(m % 60);
  return LANG === 'ta' ? (h ? `${h} மணி ${mm} நிமி` : `${mm} நிமி`) : (h ? `${h} h ${mm} m` : `${mm} min`);
};
const money = n => (n < 0 ? '−' : '') + '₹' + Math.abs(Math.round(n)).toLocaleString('en-IN');
const compactMoney = n => { const a = Math.abs(n), s = n < 0 ? '−' : ''; return a >= 1e5 ? `${s}₹${nf(a / 1e5, 1)}${LANG === 'ta' ? ' லட்.' : 'L'}` : a >= 1e3 ? `${s}₹${nf(a / 1e3, a >= 1e4 ? 0 : 1)}k` : `${s}₹${nf(a)}`; };
const dateObj = s => new Date(String(s).slice(0, 10) + 'T00:00');
const shortDate = s => dateObj(s).toLocaleDateString(L.locale, { day: 'numeric', month: 'short' });
const dayName = (s, long) => dateObj(s).toLocaleDateString(L.locale, long ? { weekday: 'long', day: 'numeric', month: 'short' } : { weekday: 'short' });
function relDay(s, long) {
  const d = FFWater.daysBetween(todayISO(), String(s).slice(0, 10));
  if (d === 0) return L.common.today;
  if (d === 1) return LANG === 'ta' ? 'நாளை' : 'tomorrow';
  return dayName(s, long);
}

/* ---------- Section sub-navigation ---------- */
// A row of links under the page title; in the Android app it becomes M3 chips, in the iOS app a segmented-style row.
function subnav(items, on, label) {
  return `<nav class="subnav" aria-label="${esc(label)}">${items.map(([k, href, text]) =>
    `<a href="${href}" class="${k === on ? 'on' : ''}"${k === on ? ' aria-current="page"' : ''}>${esc(text)}</a>`).join('')}</nav>`;
}
const sampleNote = () => (farm.data.sample ? `<p class="sample-note">${icon('alert')}<span>${esc(L.sample)} <a class="link" href="#/settings">${esc(L.common.settings)}</a>.</span></p>` : '');

/* ---------- Form dialog ---------- */
// fields: [{ name, label, type, value, options: [[v, text]], required, help, min, max, step, placeholder }]
const formDlg = document.createElement('dialog');
formDlg.className = 'sheet form-sheet';
document.body.append(formDlg);
formDlg.addEventListener('click', e => { if (e.target === formDlg) formDlg.close(); });
function fieldHtml(f) {
  const id = 'fd-' + f.name, req = f.required ? ' required' : '';
  const help = f.help ? `<small>${esc(f.help)}</small>` : '';
  if (f.type === 'select') return `<label class="field" for="${id}"><span>${esc(f.label)}</span><select id="${id}" name="${f.name}"${req}>${
    f.options.map(([v, t]) => `<option value="${esc(v)}" ${String(v) === String(f.value ?? '') ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>${help}</label>`;
  if (f.type === 'textarea') return `<label class="field" for="${id}"><span>${esc(f.label)}</span><textarea id="${id}" name="${f.name}" rows="3"${req} placeholder="${esc(f.placeholder || '')}">${esc(f.value ?? '')}</textarea>${help}</label>`;
  if (f.type === 'radio') return `<fieldset class="choices"><legend>${esc(f.label)}</legend>${f.options.map(([v, t, sub]) =>
    `<label><input type="radio" name="${f.name}" value="${esc(v)}"${req}><b>${esc(t)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}</label>`).join('')}</fieldset>`;
  if (f.type === 'html') return f.html;
  return `<label class="field" for="${id}"><span>${esc(f.label)}</span><input id="${id}" name="${f.name}" type="${f.type || 'text'}" value="${esc(f.value ?? '')}"${req}${
    f.min != null ? ` min="${f.min}"` : ''}${f.max != null ? ` max="${f.max}"` : ''}${f.step != null ? ` step="${f.step}"` : ''}${f.type === 'number' ? ' inputmode="decimal"' : ''} placeholder="${esc(f.placeholder || '')}" autocomplete="off">${help}</label>`;
}
// onSave(values, form) returns false to keep the dialog open.
function openForm({ title, lede, fields, onSave, extra = '', saveText }) {
  formDlg.innerHTML = `<form method="dialog" class="sheet-inner" novalidate>
    <div class="sheet-head"><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="${esc(L.common.close)}">${icon('x')}</button></div>
    ${lede ? `<p class="muted">${esc(lede)}</p>` : ''}
    <div class="form-grid">${fields.map(fieldHtml).join('')}</div>${extra}
    <div class="sheet-actions"><button type="button" class="btn btn-outline" data-close>${esc(L.common.cancel)}</button><button class="btn btn-primary" value="ok">${esc(saveText || L.common.save)}</button></div>
  </form>`;
  const form = formDlg.querySelector('form');
  form.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => formDlg.close()));
  form.addEventListener('submit', e => {
    e.preventDefault();
    if (!form.reportValidity()) return;
    const values = Object.fromEntries(new FormData(form).entries());
    if (onSave(values, form) !== false) formDlg.close();
  });
  formDlg.showModal();
  if (ios) KolamIOS.enhance(formDlg);
  setTimeout(() => form.querySelector('input:not([type=radio]), select, textarea')?.focus({ preventScroll: true }), 30);
  return form;
}

/* ---------- Toast with undo ---------- */
let toastT;
function toast(msg, undo) {
  if (m3.enabled && window.KolamM3) { KolamM3.snackbar(msg, undo ? { action: L.common.undo, onAction: undo } : {}); return; }
  let t = document.querySelector('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.append(t); }
  t.innerHTML = `<span>${esc(msg)}</span>${undo ? `<button type="button" class="link">${esc(L.common.undo)}</button>` : ''}`;
  if (undo) t.querySelector('button').onclick = () => { undo(); t.classList.remove('show'); };
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 5000);
}
const rerender = () => { const y = scrollY; route(); scrollTo(0, y); };
const confirmAsk = msg => confirm(msg);

/* ---------- Small parts ---------- */
const meter = (v, tone) => `<span class="meter ${tone || ''}" aria-hidden="true"><i style="width:${Math.round(Math.max(0, Math.min(1, v)) * 100)}%"></i></span>`;
const badge = (text, tone) => `<span class="badge ${tone || ''}">${esc(text)}</span>`;
function download(name, text) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
