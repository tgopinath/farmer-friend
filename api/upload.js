// POST /api/upload?name=<file>  body = image bytes (resized in the browser)  → { url }   (admin only)
import { put } from '@vercel/blob';
import { isAdmin, json } from './_store.js';

const TYPES = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

export async function POST(req) {
  if (!(await isAdmin(req))) return json({ error: 'Wrong username or password' }, 401);
  const type = (req.headers.get('content-type') || '').split(';')[0];
  if (!TYPES[type]) return json({ error: 'Upload a JPEG, PNG or WebP image' }, 415);
  const buf = Buffer.from(await req.arrayBuffer());
  if (buf.length > 4 * 1024 * 1024) return json({ error: 'Image is larger than 4 MB' }, 413);
  const base = (new URL(req.url).searchParams.get('name') || 'plant').toLowerCase().replace(/[^a-z0-9-]+/g, '-').slice(0, 40) || 'plant';
  const blob = await put(`photos/${base}.${TYPES[type]}`, buf, { access: 'public', contentType: type, addRandomSuffix: true });
  return json({ url: blob.url });
}
