// Opens every screen in headless Chrome, in English and Tamil, at phone and desktop width, in the browser,
// Android (?app=android) and iOS (?app=ios) looks. Fails on console errors, page errors, overflowing pages
// and clipped tab labels. Screenshots go to .smoke/ when SHOTS=1. Run: node tools/smoke.mjs [filter]
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const OUT = path.join(ROOT, '.smoke');
const sleep = ms => new Promise(r => setTimeout(r, ms));
const only = process.argv[2] || '';
const ROUTES = ['#/', '#/crops', '#/seasons', '#/organic', '#/organic/jeevamrutham', '#/crop/rice', '#/sources',
  '#/water', '#/water/fields', '#/water/field/s-tom', '#/water/rain', '#/water/use',
  '#/drying', '#/drying/materials', '#/drying/m/turmeric', '#/drying/plan/red-chilli', '#/drying/guide',
  '#/farm', '#/farm/animals', '#/farm/animal/raja', '#/farm/money', '#/farm/stock', '#/farm/health', '#/settings'];
const MODES = (process.env.MODES || 'web,android,ios').split(',');
const LANGS = (process.env.LANGS || 'en,ta').split(',');
const SIZES = (process.env.SIZES || '390,1440').split(',').map(Number);

if (process.env.SHOTS) fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(ROOT, '.smoke-'));
const port = 5900 + Math.floor(Math.random() * 90), dbg = port + 1000;
const server = spawn('python3', ['-m', 'http.server', String(port), '--bind', '127.0.0.1', '--directory', ROOT], { stdio: 'ignore' });
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${dbg}`, `--user-data-dir=${tmp}/p`, 'about:blank'], { stdio: 'ignore' });
let failures = 0;
try {
  let ws;
  for (let i = 0; i < 60 && !ws; i++) { try { const p = (await (await fetch(`http://127.0.0.1:${dbg}/json`)).json()).find(t => t.type === 'page'); if (p) ws = new WebSocket(p.webSocketDebuggerUrl); } catch {} if (!ws) await sleep(250); }
  await new Promise((r, j) => { ws.onopen = r; ws.onerror = j; });
  let id = 0; const pending = {}, errors = [];
  ws.onmessage = e => { const m = JSON.parse(e.data);
    if (m.id && pending[m.id]) { pending[m.id](m); delete pending[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text);
    if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') errors.push(m.params.args.map(a => a.value ?? a.description).join(' '));
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error' && !/favicon|net::ERR_|Failed to load resource/.test(m.params.entry.text)) errors.push(m.params.entry.text);
  };
  const send = (method, params = {}) => new Promise(r => { const i = ++id; pending[i] = r; ws.send(JSON.stringify({ id: i, method, params })); });
  await send('Runtime.enable'); await send('Log.enable'); await send('Page.enable');
  const origin = `http://127.0.0.1:${port}`;
  const evalJS = async expr => (await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.result?.value;
  for (const mode of MODES) for (const lang of LANGS) for (const w of SIZES) {
    if (mode !== 'web' && w > 600) continue;
    await send('Emulation.setDeviceMetricsOverride', { width: w, height: w < 600 ? 844 : 900, deviceScaleFactor: 1, mobile: w < 600 });
    await send('Page.navigate', { url: `${origin}/index.html?app=${mode}` }); await sleep(1200);
    await evalJS(`localStorage.setItem('ff.lang', '"${lang}"'); sessionStorage.clear(); true`);
    for (const r of ROUTES) {
      const tag = `${mode}/${lang}/${w} ${r}`;
      if (only && !tag.includes(only)) continue;
      errors.length = 0;
      await send('Page.navigate', { url: `${origin}/index.html?app=${mode}&n=${++id}${r}` }); await sleep(r === '#/' || /water|drying/.test(r) ? 2200 : 1100);
      const check = await evalJS(`(() => {
        const out = [];
        const vw = visualViewport ? visualViewport.width : innerWidth;
        if (document.documentElement.scrollWidth > vw + 1 || innerWidth > vw + 1) out.push('page overflows sideways by ' + (Math.max(document.documentElement.scrollWidth, innerWidth) - vw) + 'px');
        const tabs = [...document.querySelectorAll('.tabs a span, .md-nav-label, .ios-tab span')].filter(e => e.offsetParent);
        for (const t of tabs) if (t.scrollWidth > t.clientWidth + 1) out.push('tab label clipped: ' + t.textContent);
        if (!document.querySelector('#app').textContent.trim()) out.push('empty page');
        if (/undefined|NaN|\\[object/.test(document.querySelector('#app').innerText)) out.push('undefined/NaN/[object] in text: ' + (document.querySelector('#app').innerText.match(/.{0,40}(undefined|NaN|\\[object).{0,20}/) || [''])[0]);
        return out;
      })()`);
      const problems = [...(check || []), ...errors];
      if (problems.length) { failures++; console.log('FAIL', tag, '\n   ' + problems.join('\n   ')); }
      if (process.env.SHOTS) {
        const s = await send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
        fs.writeFileSync(path.join(OUT, `${mode}-${lang}-${w}-${r.replace(/[#/]+/g, '_') || 'home'}.jpg`), Buffer.from(s.result.data, 'base64'));
      }
    }
  }
  console.log(failures ? `${failures} screen(s) with problems` : 'OK: every screen rendered without errors');
  ws.close();
} finally {
  chrome.kill(); server.kill(); await sleep(500);
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
process.exit(failures ? 1 : 0);
