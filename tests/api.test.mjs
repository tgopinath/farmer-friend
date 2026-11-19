// The health-check route without a key: demo answer, input checks and the rate limit. Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';

delete process.env.ANTHROPIC_API_KEY; delete process.env.ANTHROPIC_AUTH_TOKEN;
const { POST, Assessment } = await import('../api/health-check.js');
const call = (body, ip = '10.0.0.' + Math.floor(Math.random() * 250)) => POST(new Request('http://x/api/health-check', {
  method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': ip }, body: typeof body === 'string' ? body : JSON.stringify(body) }));
const photo = 'A'.repeat(400);

test('no key: a marked sample answer that fits the schema, in Tamil when asked', async () => {
  const r = await call({ imageBase64: photo, lang: 'ta' });
  assert.equal(r.status, 200);
  const { result } = await r.json();
  assert.equal(result.demo, true);
  const { demo, ...rest } = result;
  assert.ok(Assessment.safeParse(rest).success);
  assert.match(result.summary, /[஀-௿]/);
});

test('checks the input', async () => {
  assert.equal((await call('not json')).status, 400);
  assert.equal((await call({ imageBase64: 'x' })).status, 400);
  assert.equal((await call({ imageBase64: photo, mediaType: 'text/html' })).status, 415);
  assert.equal((await call({ imageBase64: 'A'.repeat(5_700_000) })).status, 413);
});

test('rate limit: the seventh check in ten minutes from one visitor is refused', async () => {
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await call({ imageBase64: photo }, '192.168.9.9')).status);
  assert.deepEqual(codes.slice(0, 6), [200, 200, 200, 200, 200, 200]);
  assert.equal(codes[6], 429);
});
