// Livestock & farm books logic, ported from Farm Manager's summary.js (same rules, same ranking):
// account balances, stock days-left, maintenance due dates, the "Needs attention" reminders and the
// month summary. Pure functions of the records and a "today", so they can be tested. Reminders carry
// codes and numbers, not sentences; i18n-more.js turns them into English or Tamil.
(function (root) {
  const DAY = 86400000;
  const dayOf = v => String(v ?? '').slice(0, 10);
  const daysBetween = (from, to) => Math.round((Date.parse(dayOf(to)) - Date.parse(dayOf(from))) / DAY);
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);
  /** Upcoming window for vaccinations and maintenance. */
  const SOON_DAYS = 7;
  /** Warn when feed will run out within this many days at the current rate. */
  const FEED_DAYS = 5;
  const SPECIES = ['goat', 'cow', 'chicken'];

  function accountBalances(accounts, transactions) {
    return accounts.map(a => {
      let balance = num(a.openingBalance);
      for (const t of transactions) if (t.accountId === a.id) balance += t.type === 'income' ? num(t.amount) : -num(t.amount);
      return { id: a.id, name: a.name, balance, minBalance: num(a.minBalance) };
    });
  }

  function stockLevel(item) {
    const quantity = num(item.quantity), daily = num(item.dailyUse);
    const daysLeft = daily > 0 ? Math.floor(quantity / daily) : null;
    const low = quantity <= num(item.minLevel) || (daysLeft !== null && daysLeft <= FEED_DAYS);
    return { quantity, daysLeft, low };
  }

  /** The next date a recurring maintenance task is due. */
  function maintenanceDue(task) {
    if (task.dueDate) return dayOf(task.dueDate);
    if (task.lastDone && num(task.everyDays) > 0) return new Date(Date.parse(dayOf(task.lastDone)) + num(task.everyDays) * DAY).toISOString().slice(0, 10);
    return null;
  }

  // Feed with a daily use, soonest to run out first (the overview's "Feed levels").
  const feedDays = inventory => inventory.filter(i => i.category === 'feed' && num(i.dailyUse) > 0)
    .map(i => ({ ...i, days: Math.floor(num(i.quantity) / num(i.dailyUse)) })).sort((a, b) => a.days - b.days);

  /**
   * Each reminder: { kind, level, date, ref, ...facts }. kind: vaccination | feed | stock | balance | maintenance | health;
   * level: overdue | warning | due. Sorted overdue first, then warning, then due, then by date.
   */
  function reminders(data, today) {
    today = today || new Date().toISOString();
    const out = [];
    const animals = new Map(data.animals.map(a => [a.id, a]));
    const who = v => { const a = animals.get(v.animalId); return a ? { animal: a.name || a.tag || a.species } : { species: v.species || '' }; };

    for (const v of data.vaccinations) {
      if (v.givenDate || !v.dueDate) continue;
      const d = daysBetween(today, v.dueDate);
      if (d > SOON_DAYS) continue;
      out.push({ kind: 'vaccination', level: d < 0 ? 'overdue' : 'due', vaccine: v.vaccine, ...who(v), days: d, date: dayOf(v.dueDate), ref: { collection: 'vaccinations', id: v.id } });
    }
    for (const item of data.inventory) {
      const s = stockLevel(item);
      if (!s.low) continue;
      out.push({ kind: item.category === 'feed' ? 'feed' : 'stock', level: s.quantity <= 0 || s.daysLeft === 0 ? 'overdue' : 'warning',
        item: item.name, daysLeft: s.daysLeft, quantity: s.quantity, unit: item.unit || '', date: dayOf(today), ref: { collection: 'inventory', id: item.id } });
    }
    for (const b of accountBalances(data.accounts, data.transactions)) {
      if (b.balance >= b.minBalance) continue;
      out.push({ kind: 'balance', level: b.balance < 0 ? 'overdue' : 'warning', account: b.name, balance: b.balance, minBalance: b.minBalance, date: dayOf(today), ref: { collection: 'accounts', id: b.id } });
    }
    for (const t of data.maintenance) {
      const due = maintenanceDue(t);
      if (!due) continue;
      const d = daysBetween(today, due);
      if (d > SOON_DAYS) continue;
      out.push({ kind: 'maintenance', level: d < 0 ? 'overdue' : 'due', task: t.title, days: d, date: due, ref: { collection: 'maintenance', id: t.id } });
    }
    for (const a of data.animals) {
      if (a.status !== 'sick') continue;
      out.push({ kind: 'health', level: 'warning', animal: a.name || a.tag || a.species, date: dayOf(today), ref: { collection: 'animals', id: a.id } });
    }
    const rank = { overdue: 0, warning: 1, due: 2 };
    return out.sort((x, y) => rank[x.level] - rank[y.level] || x.date.localeCompare(y.date));
  }

  function summary(data, today) {
    today = today || new Date().toISOString();
    const month = dayOf(today).slice(0, 7), livestock = {};
    for (const a of data.animals) {
      if (a.status === 'sold' || a.status === 'dead') continue;
      const s = (livestock[a.species] ??= { head: 0, sick: 0 });
      const n = Math.max(1, num(a.count) || 1);
      s.head += n;
      if (a.status === 'sick') s.sick += n;
    }
    let income = 0, expense = 0;
    const byCategory = {};
    for (const t of data.transactions) {
      if (dayOf(t.date).slice(0, 7) !== month) continue;
      const amt = num(t.amount);
      if (t.type === 'income') income += amt;
      else { expense += amt; byCategory[t.category || 'Other'] = (byCategory[t.category || 'Other'] ?? 0) + amt; }
    }
    const balances = accountBalances(data.accounts, data.transactions);
    return {
      today: dayOf(today), livestock,
      month: { month, income, expense, net: income - expense, expenseByCategory: byCategory },
      balances, totalBalance: balances.reduce((s, b) => s + b.balance, 0),
      reminders: reminders(data, today),
    };
  }

  root.FFBooks = { SPECIES, SOON_DAYS, FEED_DAYS, accountBalances, stockLevel, maintenanceDue, feedDays, reminders, summary, daysBetween, dayOf };
})(typeof self !== 'undefined' ? self : globalThis);
