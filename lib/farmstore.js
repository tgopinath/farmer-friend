// One farm profile for every section, kept on this device (localStorage "ff.farm"):
// fields and water sources (Water), watering logs and catchments, and the livestock books
// (animals, health, vaccinations, money, accounts, stock, upkeep). Export and import keep a backup.
(function (root) {
  const KEY = 'ff.farm';
  const COLLECTIONS = ['fields', 'sources', 'logs', 'catchments', 'animals', 'health', 'vaccinations', 'transactions', 'accounts', 'inventory', 'maintenance'];
  const blank = () => ({ v: 1, sample: false, running: null, annualRain: 900, ...Object.fromEntries(COLLECTIONS.map(c => [c, []])) });
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const pad = n => String(n).padStart(2, '0');
  const localISO = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return localISO(d); };

  // A sample farm near Coimbatore, dated relative to today: four irrigated fields on a borewell and a farm pond,
  // goats, two cows and two chicken flocks, with books for the last two months (from the Water and Farm Manager demos).
  function sample(today = localISO()) {
    const t = today, day = n => addDays(t, n);
    let n = 0;
    const r = o => ({ id: o.id || 's' + (++n), ...o });
    const bore = r({ id: 's-bore', name: 'Borewell', kind: 'borewell', flowLpm: 220, hp: 5, depthFt: 650 });
    const pond = r({ id: 's-pond', name: 'Farm pond', kind: 'pond', flowLpm: 300, hp: 2, capacityL: 800000, levelL: 520000 });
    const sump = r({ id: 's-sump', name: 'Rooftop sump', kind: 'tank', flowLpm: 60, hp: 1, capacityL: 25000, levelL: 18000 });
    const fields = [
      r({ id: 's-tom', name: 'East plot', crop: 'tomato', acres: 1, soil: 'red', method: 'drip', sown: day(-48), sourceId: 's-bore' }),
      r({ id: 's-coc', name: 'Coconut grove', crop: 'coconut', acres: 3, soil: 'red', method: 'drip', sown: '', sourceId: 's-bore' }),
      r({ id: 's-pad', name: 'Low field', crop: 'paddy', acres: 0.5, soil: 'black', method: 'flood', sown: day(-22), sourceId: 's-pond' }),
      r({ id: 's-ban', name: 'Banana row', crop: 'banana', acres: 0.75, soil: 'loam', method: 'drip', sown: day(-150), sourceId: 's-pond' }),
    ];
    const logs = [];
    const water = (fieldId, sourceId, ago, minutes, flow) => logs.push(r({ type: 'water', fieldId, sourceId, date: day(-ago), minutes, litres: minutes * flow }));
    [12, 8, 4, 1].forEach(d => water('s-tom', 's-bore', d, 70, 220));
    [10, 3].forEach(d => water('s-coc', 's-bore', d, 150, 220));
    [9, 6, 3].forEach(d => water('s-pad', 's-pond', d, 140, 300));
    [7, 2].forEach(d => water('s-ban', 's-pond', d, 90, 300));
    logs.push(r({ type: 'check', fieldId: 's-tom', date: day(-20), level: 0 }));

    const sbi = r({ id: 'sbi', name: 'SBI savings', openingBalance: 42000, minBalance: 15000 });
    const cash = r({ id: 'cash', name: 'Cash box', openingBalance: 3000, minBalance: 2000 });
    const tx = (type, amount, category, d, accountId, species = '') => r({ type, amount, category, date: day(d), accountId, species });
    return {
      ...blank(), sample: true, fields, sources: [bore, pond, sump], logs,
      catchments: [
        r({ name: 'House terrace', surface: 'concrete', m2: 120, to: 'sump' }),
        r({ name: 'Store-room roof', surface: 'sheet', m2: 80, to: 'recharge' }),
        r({ name: 'Land draining to pit', surface: 'bare', m2: 600, to: 'recharge' }),
      ],
      accounts: [sbi, cash],
      animals: [
        r({ id: 'lakshmi', species: 'goat', name: 'Lakshmi', tag: 'G-014', breed: 'Boer', sex: 'female', status: 'pregnant', birthDate: '2024-03-10', weightKg: 38, count: 1 }),
        r({ id: 'raja', species: 'goat', name: 'Raja', tag: 'G-002', breed: 'Jamunapari', sex: 'male', status: 'sick', birthDate: '2023-01-05', weightKg: 52, count: 1, notes: 'Coughing since Monday' }),
        r({ id: 'gauri', species: 'cow', name: 'Gauri', tag: 'C-01', breed: 'Gir', sex: 'female', status: 'healthy', birthDate: '2021-07-01', weightKg: 380, count: 1 }),
        r({ id: 'kids', species: 'goat', name: 'Kid group', breed: 'Mixed', sex: 'mixed', status: 'healthy', count: 9 }),
        r({ id: 'nandi', species: 'cow', name: 'Nandi', tag: 'C-02', breed: 'Sahiwal', sex: 'male', status: 'healthy', count: 1 }),
        r({ id: 'layers', species: 'chicken', name: 'Layer flock A', breed: 'BV-380', sex: 'female', status: 'healthy', count: 120 }),
        r({ id: 'country', species: 'chicken', name: 'Country chickens', breed: 'Kadaknath', sex: 'mixed', status: 'healthy', count: 35 }),
      ],
      vaccinations: [
        r({ vaccine: 'PPR', species: 'goat', dueDate: day(-2) }),
        r({ vaccine: 'Lasota (ND)', species: 'chicken', dueDate: day(3) }),
        r({ vaccine: 'FMD', animalId: 'gauri', dueDate: day(20) }),
        r({ vaccine: 'ET', animalId: 'lakshmi', dueDate: day(-30), givenDate: day(-30) }),
      ],
      inventory: [
        r({ name: 'Layer mash', category: 'feed', quantity: 45, unit: 'kg', minLevel: 30, dailyUse: 14, unitCost: 32 }),
        r({ name: 'Green fodder', category: 'feed', quantity: 600, unit: 'kg', minLevel: 150, dailyUse: 45 }),
        r({ name: 'Goat pellets', category: 'feed', quantity: 120, unit: 'kg', minLevel: 40, dailyUse: 6, unitCost: 28 }),
        r({ name: 'Mineral mixture', category: 'medicine', quantity: 4, unit: 'kg', minLevel: 2 }),
        r({ name: 'Eggs in store', category: 'produce', quantity: 180, unit: 'pcs' }),
      ],
      maintenance: [
        r({ title: 'Clean water tank', asset: 'Main tank', everyDays: 30, lastDone: day(-27) }),
        r({ title: 'Service borewell pump', asset: 'Pump', dueDate: day(-1), cost: 1500 }),
        r({ title: 'Lime wash poultry shed', asset: 'Shed B', everyDays: 90, lastDone: day(-40) }),
      ],
      transactions: [
        tx('income', 9600, 'Eggs', -3, 'sbi', 'chicken'), tx('income', 14200, 'Milk', -5, 'sbi', 'cow'),
        tx('income', 18000, 'Animal sale', -12, 'sbi', 'goat'), tx('expense', 22400, 'Feed', -8, 'sbi'),
        tx('expense', 1800, 'Vet', -2, 'cash', 'goat'), tx('expense', 12000, 'Labour', -1, 'sbi'),
        tx('expense', 2300, 'Electricity', -6, 'sbi'), tx('expense', 900, 'Medicine', -4, 'cash'),
        tx('expense', 14500, 'Feed', -35, 'sbi'), tx('income', 15800, 'Milk', -36, 'sbi', 'cow'),
      ],
      health: [r({ animalId: 'raja', date: day(-2), kind: 'vet', summary: 'Vet visit: mild respiratory infection. Oxytetracycline for 5 days.', cost: 600 })],
    };
  }

  function load(storage) {
    try { const raw = storage && storage.getItem(KEY); if (raw) return { ...blank(), ...JSON.parse(raw) }; } catch (e) {}
    return null;
  }

  // A small store over one plain object; every change is saved at once.
  function create(storage) {
    let db = load(storage) || sample();
    const save = () => { try { storage && storage.setItem(KEY, JSON.stringify(db)); } catch (e) {} };
    if (!load(storage)) save();
    return {
      get data() { return db; },
      list: c => db[c] || (db[c] = []),
      find: (c, id) => (db[c] || []).find(x => x.id === id),
      add(c, rec) { const x = { ...rec, id: rec.id || uid() }; (db[c] || (db[c] = [])).push(x); save(); return x; },
      update(c, id, patch) { const x = (db[c] || []).find(r => r.id === id); if (x) { Object.assign(x, patch); save(); } return x; },
      remove(c, id) { const list = db[c] || [], i = list.findIndex(r => r.id === id); if (i < 0) return null; const [gone] = list.splice(i, 1); save(); return { gone, i }; },
      restore(c, gone, i) { (db[c] || (db[c] = [])).splice(i, 0, gone); save(); },
      set(k, v) { db[k] = v; save(); },
      replace(next) { db = { ...blank(), ...next }; save(); },
      reset(kind) { db = kind === 'sample' ? sample() : blank(); save(); },
      exportJSON: () => JSON.stringify(db, null, 2),
      save,
    };
  }

  root.FFFarm = { KEY, COLLECTIONS, blank, sample, create, uid, localISO, addDays };
})(typeof self !== 'undefined' ? self : globalThis);
