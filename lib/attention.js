// "Today on your farm": one ranked list of what needs attention across every section.
// Farm Manager's ranking (overdue, then act soon, then this week, then by date) is kept and extended:
// a stressed field ranks with overdue items, a field to water today with "act soon", rain on the way
// with "this week", and plain information (a good drying day, crops to sow) comes last.
(function (root) {
  // Shared levels: now (act now), soon (today), week (this week), info.
  const LEVEL_RANK = { now: 0, soon: 1, week: 2, info: 3 };
  const FARM_LEVEL = { overdue: 'now', warning: 'soon', due: 'week' };
  const WATER_LEVEL = { urgent: 'now', water: 'soon', hold: 'week' };
  const SECTION_ORDER = { farm: 0, water: 1, drying: 2, crops: 3 };

  const fromFarm = reminders => reminders.map(r => ({ section: 'farm', level: FARM_LEVEL[r.level], kind: 'farm.' + r.kind, date: r.date, item: r }));

  // advices: [{ field, advice }]; only fields that need something today appear.
  const fromWater = advices => advices.filter(x => x.advice && WATER_LEVEL[x.advice.key])
    .map(x => ({ section: 'water', level: WATER_LEVEL[x.advice.key], kind: 'water.' + x.advice.key, date: x.advice.t ? x.advice.t.date : '', item: x }));

  // Heavy rain in the next days is worth knowing for the borewell recharge pit.
  const fromRain = outlook => (outlook && outlook.big.length ? [{ section: 'water', level: 'week', kind: 'water.rain', date: outlook.big[0].date, item: outlook.big[0] }] : []);

  // Today's drying: a good day is information, a slow or rainy one is a warning for anything on the trays.
  function fromDrying(days) {
    const d = days && days[0];
    if (!d) return [];
    if (d.f >= 0.85) return [{ section: 'drying', level: 'info', kind: 'drying.good', date: d.date, item: d }];
    if (d.rain >= 60) return [{ section: 'drying', level: 'soon', kind: 'drying.rain', date: d.date, item: d }];
    return [{ section: 'drying', level: 'info', kind: d.f >= 0.55 ? 'drying.fair' : 'drying.slow', date: d.date, item: d }];
  }

  const fromCrops = (sowCount, harvestCount, date) => [
    ...(sowCount ? [{ section: 'crops', level: 'info', kind: 'crops.sow', date, item: { n: sowCount } }] : []),
    ...(harvestCount ? [{ section: 'crops', level: 'info', kind: 'crops.harvest', date, item: { n: harvestCount } }] : []),
  ];

  // Stable: level, then date, then section, then the order each section gave.
  function rank(items) {
    return items.map((x, i) => ({ x, i })).sort((a, b) =>
      LEVEL_RANK[a.x.level] - LEVEL_RANK[b.x.level] || String(a.x.date).localeCompare(String(b.x.date)) ||
      SECTION_ORDER[a.x.section] - SECTION_ORDER[b.x.section] || a.i - b.i).map(o => o.x);
  }

  const counts = items => items.reduce((c, x) => { c[x.level] = (c[x.level] || 0) + 1; return c; }, {});

  root.FFAttention = { LEVEL_RANK, fromFarm, fromWater, fromRain, fromDrying, fromCrops, rank, counts };
})(typeof self !== 'undefined' ? self : globalThis);
