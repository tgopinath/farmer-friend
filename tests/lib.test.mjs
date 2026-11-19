// Tests for the shared layer and the logic ported from Water Manager, Solar Dry House and Farm Manager.
// Run: node --test tests/
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const root = decodeURIComponent(new URL('..', import.meta.url).pathname);
// The lib files are classic browser scripts that attach to `self`; run them against a plain object.
const self = {};
for (const f of ['wx', 'water', 'dry', 'farmbooks', 'attention', 'farmstore']) new Function('self', readFileSync(root + 'lib/' + f + '.js', 'utf8'))(self);
const { FFWx, FFWater, FFDry, FFBooks, FFAttention, FFFarm } = self;

// A synthetic Open-Meteo reply: 30 past days, today, 15 ahead.
function reply({ today = '2026-11-19', rain = () => 0, prob = () => 10, rad = () => 22, rh = () => 60, et0 = () => 5 } = {}) {
  const t0 = Date.parse(today + 'T00:00Z'), time = [], n = 46;
  for (let i = -30; i < 16; i++) time.push(new Date(t0 + i * 864e5).toISOString().slice(0, 10));
  const arr = f => time.map((_, i) => f(i - 30));
  return {
    current: { time: today + 'T10:00', temperature_2m: 31, relative_humidity_2m: 62, weather_code: 1, wind_speed_10m: 8, shortwave_radiation: 700, is_day: 1, cloud_cover: 20 },
    daily: { time, weather_code: arr(() => 1), temperature_2m_max: arr(() => 32), temperature_2m_min: arr(() => 23), precipitation_sum: arr(rain),
      precipitation_probability_max: arr(prob), et0_fao_evapotranspiration: arr(et0), relative_humidity_2m_mean: arr(rh),
      shortwave_radiation_sum: arr(rad), cloud_cover_mean: arr(() => 20), sunrise: arr(() => '06:10'), sunset: arr(() => '17:50') },
  };
}

test('weather: one reply serves today, water and drying', () => {
  const d = reply();
  assert.equal(FFWx.todayIndex(d), 30);
  assert.equal(FFWx.ahead(d, 5).daily.time[0], '2026-11-19');
  assert.equal(FFWx.ahead(d, 5).daily.time.length, 5);
  const w = FFWx.waterDays(d);
  assert.equal(w.length, 46);
  assert.equal(w.filter(x => x.past).length, 30);
  assert.ok(w[30].today);
  const dry = FFWx.dryDays(d);
  assert.equal(dry.length, 16);
  assert.equal(dry[0].date, '2026-11-19');
  assert.ok(dry[0].house > dry[0].tmax, 'inside the dry house is warmer than outside');
  assert.equal(FFWx.rating(dry[0].f), 'good');
  assert.equal(FFWx.code(95).icon, 'storm');
});

test('water: a dry spell on a drip field asks for water; rain coming says hold', () => {
  const field = { id: 'f', crop: 'tomato', acres: 1, soil: 'red', method: 'drip', sown: '2026-09-20' };
  const days = FFWater.rainOutlook ? FFWx.waterDays(reply()) : [];
  const a = FFWater.advise(field, days, [], { flowLpm: 220 });
  assert.ok(['water', 'urgent'].includes(a.key), a.key);
  assert.ok(a.amount.litres > 0 && a.amount.minutes > 0);
  // Heavy rain forecast for the next two days, when it is almost certain.
  const wet = FFWx.waterDays(reply({ rain: i => (i === 1 || i === 2 ? 60 : 0), prob: i => (i > 0 ? 95 : 10) }));
  assert.equal(FFWater.advise(field, wet, [], { flowLpm: 220 }).key, 'hold');
  // Watering logged today fills the soil again.
  const area = field.acres * FFWater.M2_PER_ACRE;
  const logs = [{ type: 'water', fieldId: 'f', date: '2026-11-19', litres: 200 * area }];
  assert.equal(FFWater.advise(field, days, logs, { flowLpm: 220 }).key, 'ok');
  // Not sown yet.
  assert.equal(FFWater.advise({ ...field, sown: '2026-12-01' }, days, [], null).key, 'wait');
});

test('water: crop stages, catchment litres, pump energy', () => {
  const c = FFWater.CROPS.tomato;
  assert.equal(FFWater.stage(c, -1).key, 'notsown');
  assert.equal(FFWater.stage(c, 10).key, 'initial');
  assert.equal(FFWater.stage(c, 80).key, 'mid');
  assert.equal(FFWater.stage(c, 500).key, 'ready');
  assert.equal(FFWater.stage(FFWater.CROPS.coconut, 5).key, 'established');
  assert.equal(FFWater.seasonLength(c), 145);
  // 100 m² concrete roof, 10 mm of rain → 850 litres.
  assert.equal(Math.round(FFWater.catchLitres([{ m2: 100, surface: 'concrete' }], 10)), 850);
  assert.ok(Math.abs(FFWater.pumpKwh({ hp: 5 }, 60) - 3.73) < 0.01);
  for (const k in FFWater.CROPS) assert.ok(!FFWater.CROPS[k].ff || typeof FFWater.CROPS[k].ff === 'string');
});

test('drying: days to moisture, dried weight, ready date', () => {
  const chilli = { mi: 75, ms: 10, me: 2.5, d: [4, 6] };
  assert.ok(Math.abs(FFDry.daysTo(chilli, 10) - 5) < 1e-9, 'reaches safe moisture in the typical days');
  assert.equal(FFDry.daysTo(chilli, 2), null, "can't go below the equilibrium moisture");
  assert.equal(FFDry.daysTo(chilli, 80), 0);
  assert.equal(FFDry.driedWeight(100, 75, 10).toFixed(2), '27.78');
  const F = FFWx.dryDays(reply());
  const f = FFDry.finishDate(2, F, 8);
  assert.equal(f.startsTomorrow, false);
  assert.ok(f.date >= '2026-11-19' && f.date <= '2026-11-22');
  assert.equal(FFDry.finishDate(2, F, 14).startsTomorrow, true);
  const slow = FFWx.dryDays(reply({ rad: () => 6, rh: () => 90 }));
  assert.equal(FFDry.finishDate(40, slow, 8).beyond, true);
  const b = FFDry.bestStart(F, 8);
  assert.equal(b.index, 0);
  assert.equal(b.slow, 0);
});

test('farm books: reminders keep Farm Manager rules and ranking', () => {
  const data = FFFarm.sample('2026-11-19');
  const r = FFBooks.reminders(data, '2026-11-19');
  const kinds = r.map(x => x.kind + ':' + x.level);
  // PPR 2 days late, pump service 1 day late, layer mash 3 days left (≤ 5), Raja sick, Lasota in 3 days, tank in 3 days.
  assert.ok(kinds.includes('vaccination:overdue'));
  assert.ok(kinds.includes('maintenance:overdue'));
  assert.ok(kinds.includes('feed:warning'));
  assert.ok(kinds.includes('health:warning'));
  assert.ok(kinds.includes('vaccination:due'));
  const rank = { overdue: 0, warning: 1, due: 2 };
  for (let i = 1; i < r.length; i++) assert.ok(rank[r[i - 1].level] <= rank[r[i].level], 'sorted by level');
  // Given vaccinations and far-off ones do not show.
  assert.ok(!r.some(x => x.vaccine === 'ET' || x.vaccine === 'FMD'));
  const layer = r.find(x => x.item === 'Layer mash');
  assert.equal(layer.daysLeft, 3);
});

test('farm books: stock days left, balances, maintenance, summary', () => {
  assert.deepEqual(FFBooks.stockLevel({ quantity: 45, dailyUse: 14, minLevel: 30 }), { quantity: 45, daysLeft: 3, low: true });
  assert.deepEqual(FFBooks.stockLevel({ quantity: 600, dailyUse: 45, minLevel: 150 }), { quantity: 600, daysLeft: 13, low: false });
  assert.equal(FFBooks.stockLevel({ quantity: 4, minLevel: 2 }).daysLeft, null);
  assert.equal(FFBooks.maintenanceDue({ lastDone: '2026-10-23', everyDays: 30 }), '2026-11-22');
  assert.equal(FFBooks.maintenanceDue({ dueDate: '2026-11-18' }), '2026-11-18');
  const data = FFFarm.sample('2026-11-19');
  const feeds = FFBooks.feedDays(data.inventory);
  assert.deepEqual(feeds.map(f => f.name), ['Layer mash', 'Green fodder', 'Goat pellets']);
  const s = FFBooks.summary(data, '2026-11-19');
  assert.equal(s.livestock.chicken.head, 155);
  assert.equal(s.livestock.goat.sick, 1);
  const b = FFBooks.accountBalances(data.accounts, data.transactions);
  assert.equal(b.find(x => x.id === 'cash').balance, 3000 - 1800 - 900);
  assert.equal(s.totalBalance, b.reduce((t, x) => t + x.balance, 0));
});

test('attention: one ranked list across sections', () => {
  const data = FFFarm.sample('2026-11-19');
  const farm = FFAttention.fromFarm(FFBooks.reminders(data, '2026-11-19'));
  const water = FFAttention.fromWater([
    { field: { id: 'a' }, advice: { key: 'urgent', t: { date: '2026-11-19' } } },
    { field: { id: 'b' }, advice: { key: 'ok', t: { date: '2026-11-19' } } },
    { field: { id: 'c' }, advice: { key: 'hold', t: { date: '2026-11-19' } } },
  ]);
  assert.equal(water.length, 2, 'fields with enough water are left out');
  const drying = FFAttention.fromDrying([{ date: '2026-11-19', f: 1, rain: 5 }]);
  const crops = FFAttention.fromCrops(12, 3, '2026-11-19');
  const all = FFAttention.rank([...crops, ...drying, ...water, ...farm]);
  assert.equal(all[0].level, 'now');
  assert.equal(all[all.length - 1].level, 'info');
  for (let i = 1; i < all.length; i++) assert.ok(FFAttention.LEVEL_RANK[all[i - 1].level] <= FFAttention.LEVEL_RANK[all[i].level]);
  assert.equal(FFAttention.fromDrying([{ date: 'x', f: 0.3, rain: 80 }])[0].level, 'soon');
  assert.deepEqual(FFAttention.counts(all).info, 3);
});

test('farm store: one profile, sample data, CRUD with undo, reset', () => {
  const mem = new Map();
  const storage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
  const s = FFFarm.create(storage);
  assert.ok(s.data.sample);
  assert.equal(s.list('fields').length, 4);
  const a = s.add('animals', { species: 'cow', name: 'Kaveri', count: 1, status: 'healthy' });
  assert.ok(FFFarm.create(storage).find('animals', a.id), 'saved to storage');
  s.update('animals', a.id, { status: 'sick' });
  assert.equal(s.find('animals', a.id).status, 'sick');
  const { gone, i } = s.remove('animals', a.id);
  assert.equal(s.find('animals', a.id), undefined);
  s.restore('animals', gone, i);
  assert.ok(s.find('animals', a.id));
  s.reset('empty');
  assert.equal(s.list('animals').length, 0);
  assert.equal(s.data.sample, false);
  s.reset('sample');
  assert.equal(s.list('animals').length, 7);
});
