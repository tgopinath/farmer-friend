// Shared helpers for the admin API: plants added through admin.html live in one JSON file in Vercel Blob.
import { put, list } from '@vercel/blob';
import { timingSafeEqual, createHash } from 'node:crypto';

const FILE = process.env.PLANTS_PATH || 'plants.json';

export async function readPlants() {
  const { blobs } = await list({ prefix: FILE, limit: 5 });
  const b = blobs.find(x => x.pathname === FILE);
  if (!b) return [];
  // The upload time in the query gives every version its own CDN cache key.
  const r = await fetch(`${b.url}?v=${new Date(b.uploadedAt).getTime()}`, { cache: 'no-store' });
  return r.ok ? r.json() : [];
}

export async function writePlants(plants) {
  await put(FILE, JSON.stringify(plants), { access: 'public', contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true, cacheControlMaxAge: 60 });
}

const same = (a, b) => {
  const h = s => createHash('sha256').update(String(s)).digest();
  return timingSafeEqual(h(a), h(b));
};

// Basic auth against ADMIN_USER / ADMIN_PASSWORD, which are set only in the Vercel project settings.
export async function isAdmin(req) {
  const u = process.env.ADMIN_USER, p = process.env.ADMIN_PASSWORD;
  if (!u || !p) return false;
  const m = /^Basic (.+)$/.exec(req.headers.get('authorization') || '');
  if (!m) return false;
  const [user, ...rest] = Buffer.from(m[1], 'base64').toString('utf8').split(':');
  const ok = same(user, u) & same(rest.join(':'), p);
  if (!ok) await new Promise(r => setTimeout(r, 800)); // slow down password guessing
  return !!ok;
}

export const json = (data, status = 200, extra = {}) => new Response(JSON.stringify(data), {
  status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra },
});
