// FarmerFriend admin: sign in, then add, edit or delete plants stored by /api/plants.
// Credentials stay in this tab's sessionStorage only and are sent as Basic auth over HTTPS.
const $ = s => document.querySelector(s);
const API = location.port === '5240' ? 'https://farmer-friend-kappa.vercel.app' : '';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const STEP_KEYS = ['prep', 'sow', 'water', 'feed', 'weed', 'harvest'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const builtIn = CROPS.map(c => c.id);
let auth = sessionStorage.getItem('ffAdmin') || '';
let plants = [], editing = null, photo = null;

async function call(path, opts = {}) {
  const r = await fetch(API + path, { ...opts, headers: { ...(opts.headers || {}), authorization: 'Basic ' + auth } });
  const data = await r.json().catch(() => ({}));
  if (r.status === 401) { signOut('Your session ended. Sign in again.'); throw new Error('unauthorised'); }
  if (!r.ok) throw new Error(data.error || `Error ${r.status}`);
  return data;
}

/* ---------- Sign in ---------- */
$('#loginForm').addEventListener('submit', async e => {
  e.preventDefault();
  $('#loginMsg').textContent = '';
  const token = btoa(unescape(encodeURIComponent($('#user').value.trim() + ':' + $('#pass').value)));
  try {
    const r = await fetch(API + '/api/plants', { method: 'POST', headers: { authorization: 'Basic ' + token, 'content-type': 'application/json' }, body: '{"action":"login"}' });
    if (!r.ok) throw new Error(r.status === 401 ? 'Wrong username or password.' : `Server error (${r.status}).`);
    auth = token; sessionStorage.setItem('ffAdmin', auth); $('#pass').value = '';
    start();
  } catch (err) { $('#loginMsg').textContent = err.message.includes('fetch') ? 'Cannot reach the server.' : err.message; }
});
function signOut(msg) {
  auth = ''; sessionStorage.removeItem('ffAdmin');
  $('#adminMain').hidden = true; $('#loginForm').hidden = false; $('#loginMsg').textContent = msg || '';
}
$('#logout').addEventListener('click', () => signOut());

/* ---------- List ---------- */
async function loadList() {
  plants = await fetch(API + '/api/plants', { cache: 'no-store' }).then(r => r.json()).catch(() => []);
  $('#countLine').textContent = plants.length ? `${plants.length} plant${plants.length > 1 ? 's' : ''} added, on top of ${builtIn.length} built-in crops.` : `No plants added yet. The app has ${builtIn.length} built-in crops.`;
  $('#list').innerHTML = plants.map(p => `<div class="card mini">
      ${p.image?.thumb ? `<img src="${esc(p.image.thumb)}" alt="">` : `<span class="ph">${esc((p.name || '?')[0])}</span>`}
      <div><b>${esc(p.name)}</b><small>${esc(p.ta || '')} · ${esc(CATEGORIES[p.cat] || p.cat)} · updated ${new Date(p.updated).toLocaleDateString('en-IN')}</small></div>
      <span class="acts"><a class="btn btn-outline btn-small" href="./#/crop/${esc(p.id)}" target="_blank">View</a>
        <button class="btn btn-outline btn-small" data-edit="${esc(p.id)}">Edit</button>
        <button class="btn btn-danger btn-small" data-del="${esc(p.id)}">Delete</button></span></div>`).join('');
}
$('#list').addEventListener('click', async e => {
  const ed = e.target.closest('[data-edit]'), del = e.target.closest('[data-del]');
  if (ed) openForm(plants.find(p => p.id === ed.dataset.edit));
  if (del) {
    const p = plants.find(x => x.id === del.dataset.del);
    if (!confirm(`Delete “${p.name}” from the app? This cannot be undone.`)) return;
    try { await call('/api/plants', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: p.id }) }); loadList(); }
    catch (err) { alert(err.message); }
  }
});
$('#newBtn').addEventListener('click', () => openForm(null));

/* ---------- Form ---------- */
const F = $('#plantForm');
const checks = (el, items, name) => { el.innerHTML = items.map(([v, l]) => `<label><input type="checkbox" name="${name}" value="${esc(v)}">${esc(l)}</label>`).join(''); };
$('#catSel').innerHTML = Object.entries(CATEGORIES).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('');
checks($('#seasonChecks'), Object.entries(SEASONS).map(([k, v]) => [k, `${v.name} (${v.months})`]), 'seasons');
checks($('#sowChecks'), MONTHS.map((m, i) => [i + 1, m]), 'sow');
checks($('#harvestChecks'), MONTHS.map((m, i) => [i + 1, m]), 'harvest');
checks($('#compostChecks'), COMPOSTS.map(o => [o.id, o.name]), 'compost');

const pairRow = (a = '', b = '', ph = ['Name', 'Organic control']) => {
  const d = document.createElement('div'); d.className = 'row2';
  d.innerHTML = `<input placeholder="${ph[0]}" value="${esc(a)}"><input placeholder="${ph[1]}" value="${esc(b)}"><button type="button" class="btn btn-outline btn-small" aria-label="Remove">✕</button>`;
  d.querySelector('button').onclick = () => d.remove();
  return d;
};
$('#addPest').onclick = () => $('#pestRows').append(pairRow());
$('#addSrc').onclick = () => $('#srcRows').append(pairRow('', '', ['Title (publisher)', 'https://…']));
const rowsOf = el => [...el.querySelectorAll('.row2')].map(r => [...r.querySelectorAll('input')].map(i => i.value.trim())).filter(([a]) => a);

const slug = s => s.toLowerCase().replace(/\(.*?\)/g, '').trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
F.name.addEventListener('input', () => { if (!editing && !F.id.dataset.touched) F.id.value = slug(F.name.value); });
F.id.addEventListener('input', () => { F.id.dataset.touched = '1'; });

function setChecks(name, vals) { F.querySelectorAll(`input[name="${name}"]`).forEach(i => { i.checked = (vals || []).map(String).includes(i.value); }); }
function openForm(p) {
  editing = p ? p.id : null; photo = p?.image || null;
  F.reset(); delete F.id.dataset.touched; F.id.disabled = !!p;
  $('#formTitle').textContent = p ? `Edit ${p.name}` : 'Add a plant';
  $('#pestRows').innerHTML = ''; $('#srcRows').innerHTML = ''; $('#lookupRes').innerHTML = ''; $('#formMsg').textContent = '';
  if (p) {
    for (const k of ['name', 'ta', 'sci', 'id', 'cat', 'water', 'intro', 'days', 'ph', 'temp', 'rain', 'spacing', 'seed', 'soil', 'yield', 'companion']) F[k].value = p[k] || '';
    for (const k of STEP_KEYS) F['s_' + k].value = p.steps?.[k] || '';
    F.tips.value = (p.tips || []).join('\n');
    setChecks('seasons', p.seasons); setChecks('sow', p.sow); setChecks('harvest', p.harvest); setChecks('compost', p.compost);
    (p.pests || []).forEach(([a, b]) => $('#pestRows').append(pairRow(a, b)));
    (p.sources || []).forEach(([a, b]) => $('#srcRows').append(pairRow(a, b, ['Title (publisher)', 'https://…'])));
    F.imgSrc.value = p.image?.src || ''; F.imgCredit.value = p.image?.credit || '';
    const t = p.taText || {};
    for (const k of ['name', 'days', 'soil', 'temp', 'rain', 'spacing', 'seed', 'yield', 'intro', 'companion']) F['t_' + k].value = t[k] || '';
    for (const k of STEP_KEYS) F['t_s_' + k].value = t.steps?.[k] || '';
    F.t_pests.value = (t.pests || []).map(x => x.join(' | ')).join('\n'); F.t_tips.value = (t.tips || []).join('\n');
    $('#taBlock').open = !!t.name;
  } else { $('#pestRows').append(pairRow()); $('#srcRows').append(pairRow('', '', ['Title (publisher)', 'https://…'])); }
  showPhoto();
  F.hidden = false; F.scrollIntoView({ behavior: 'smooth' });
}
$('#cancelBtn').onclick = () => { F.hidden = true; scrollTo({ top: 0, behavior: 'smooth' }); };

function showPhoto() {
  const src = photo?.thumb || photo?.src || F.imgSrc.value;
  $('#photoPrev').hidden = !src; if (src) $('#photoPrev').src = src;
}
F.imgSrc.addEventListener('input', () => { photo = F.imgSrc.value ? { src: F.imgSrc.value, thumb: F.imgSrc.value, credit: F.imgCredit.value } : null; showPhoto(); });

// Resize in the browser so uploads stay small (max 1280 px, JPEG).
$('#photoFile').addEventListener('change', async e => {
  const file = e.target.files[0]; if (!file) return;
  $('#formMsg').className = 'msg'; $('#formMsg').textContent = 'Uploading photo…';
  try {
    const img = await createImageBitmap(file);
    const k = Math.min(1, 1280 / Math.max(img.width, img.height));
    const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const blob = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.84));
    const { url } = await call(`/api/upload?name=${encodeURIComponent(F.id.value || slug(F.name.value) || 'plant')}`, { method: 'POST', headers: { 'content-type': 'image/jpeg' }, body: blob });
    photo = { src: url, thumb: url, credit: F.imgCredit.value };
    F.imgSrc.value = url; showPhoto();
    $('#formMsg').className = 'msg ok'; $('#formMsg').textContent = 'Photo uploaded.';
  } catch (err) { $('#formMsg').className = 'msg err'; $('#formMsg').textContent = 'Photo upload failed: ' + err.message; }
});

/* ---------- Look up on iNaturalist ---------- */
async function lookup() {
  const q = $('#lookupQ').value.trim(); if (!q) return;
  $('#lookupRes').innerHTML = '<span class="muted">Searching…</span>';
  try {
    const [en, ta] = await Promise.all(['en', 'ta'].map(l => fetch(`https://api.inaturalist.org/v1/taxa/autocomplete?q=${encodeURIComponent(q)}&iconic_taxa=Plantae&per_page=6&preferred_place_id=6681&locale=${l}`).then(r => r.json())));
    const taName = Object.fromEntries((ta.results || []).map(t => [t.id, t.preferred_common_name]));
    const res = (en.results || []).filter(t => t.default_photo && t.iconic_taxon_name === 'Plantae');
    $('#lookupRes').innerHTML = res.map((t, i) => `<button type="button" data-i="${i}"><img src="${esc(t.default_photo.square_url)}" alt=""><span><b>${esc(t.preferred_common_name || t.name)}</b><br><i>${esc(t.name)}</i></span></button>`).join('') || '<span class="muted">No plants found.</span>';
    $('#lookupRes').onclick = e => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      const t = res[+b.dataset.i], p = t.default_photo;
      F.sci.value = t.name;
      if (!F.name.value) { F.name.value = t.preferred_common_name ? t.preferred_common_name[0].toUpperCase() + t.preferred_common_name.slice(1) : t.name; F.name.dispatchEvent(new Event('input')); }
      if (!F.ta.value && taName[t.id] && /[஀-௿]/.test(taName[t.id])) F.ta.value = taName[t.id];
      const openLicence = p.license_code && p.license_code !== 'arr';
      if (openLicence && !F.imgSrc.value) {
        photo = { src: p.medium_url.replace('/medium.', '/large.'), thumb: p.medium_url, credit: p.attribution };
        F.imgSrc.value = photo.src; F.imgCredit.value = p.attribution; showPhoto();
      }
      $('#lookupRes').innerHTML = `<span class="msg ok">Filled from iNaturalist: ${esc(t.name)}${openLicence ? ' (with photo)' : ' (photo not open-licence; upload your own)'}</span>`;
    };
  } catch { $('#lookupRes').innerHTML = '<span class="msg err">Search needs internet.</span>'; }
}
$('#lookupBtn').onclick = lookup;
$('#lookupQ').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); lookup(); } });

/* ---------- Save ---------- */
F.addEventListener('submit', async e => {
  e.preventDefault();
  const vals = name => [...F.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
  const lines = v => v.split('\n').map(x => x.trim()).filter(Boolean);
  const plant = {
    id: (F.id.value || slug(F.name.value)).trim(), name: F.name.value, ta: F.ta.value, sci: F.sci.value, cat: F.cat.value, water: F.water.value,
    seasons: vals('seasons'), sow: vals('sow').map(Number), harvest: vals('harvest').map(Number),
    intro: F.intro.value, days: F.days.value, ph: F.ph.value, temp: F.temp.value, rain: F.rain.value, spacing: F.spacing.value,
    seed: F.seed.value, soil: F.soil.value, yield: F.yield.value, companion: F.companion.value,
    steps: Object.fromEntries(STEP_KEYS.map(k => [k, F['s_' + k].value])),
    pests: rowsOf($('#pestRows')), tips: lines(F.tips.value), compost: vals('compost'),
    sources: rowsOf($('#srcRows')),
    image: F.imgSrc.value ? { src: F.imgSrc.value, thumb: photo?.thumb || F.imgSrc.value, credit: F.imgCredit.value } : null,
    taText: {
      name: F.t_name.value, days: F.t_days.value, soil: F.t_soil.value, temp: F.t_temp.value, rain: F.t_rain.value, spacing: F.t_spacing.value,
      seed: F.t_seed.value, yield: F.t_yield.value, intro: F.t_intro.value, companion: F.t_companion.value,
      steps: Object.fromEntries(STEP_KEYS.map(k => [k, F['t_s_' + k].value])),
      pests: lines(F.t_pests.value).map(l => l.split('|').map(x => x.trim())).map(([a, ...b]) => [a, b.join(' | ')]), tips: lines(F.t_tips.value),
    },
  };
  const msg = $('#formMsg'); msg.className = 'msg';
  const miss = [['name', 'Name'], ['intro', 'Introduction']].filter(([k]) => !plant[k].trim()).map(([, l]) => l);
  if (!plant.seasons.length) miss.push('Season'); if (!plant.sow.length) miss.push('Sowing months');
  if (miss.length) { msg.className = 'msg err'; msg.textContent = 'Please fill: ' + miss.join(', '); return; }
  if (!editing && builtIn.includes(plant.id)) { msg.className = 'msg err'; msg.textContent = `“${plant.id}” is already a built-in crop. Change the id.`; return; }
  $('#saveBtn').disabled = true; msg.textContent = 'Saving…';
  try {
    await call('/api/plants', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'save', plant, builtIn }) });
    msg.className = 'msg ok'; msg.innerHTML = `Saved. <a class="link" href="./#/crop/${esc(plant.id)}" target="_blank">View in the app ↗</a> (may take up to a minute to appear)`;
    editing = plant.id; F.id.disabled = true; loadList();
  } catch (err) { msg.className = 'msg err'; msg.textContent = err.message; }
  $('#saveBtn').disabled = false;
});

function start() { $('#loginForm').hidden = true; $('#adminMain').hidden = false; loadList(); }
if (auth) start(); else $('#loginForm').hidden = false;
