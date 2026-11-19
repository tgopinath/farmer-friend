// Drying section logic, ported from Solar Dry House: days to a target moisture from the drying curve,
// dried weight, the ready date from the live forecast and the best morning to load.
// Material data lives in data-dry.js; weather maths (inside temperature, day factor) in lib/wx.js.
(function (root) {
  // Moisture on a dry-weight basis (kg water per kg dry matter).
  const db = m => m / (100 - m);
  // Days to reach a target moisture on clear days, from the exponential drying curve fitted through
  // (fresh, 0 days) and (safe moisture, typical days). null when the dry house can't get that low.
  function daysTo(mat, target) {
    if (target >= mat.mi) return 0;
    if (target <= mat.me) return null;
    const X0 = db(mat.mi), Xs = db(mat.ms), Xe = db(mat.me), Xt = db(target);
    const k = Math.log((X0 - Xe) / (Xs - Xe)) / ((mat.d[0] + mat.d[1]) / 2);
    return Math.log((X0 - Xe) / (Xt - Xe)) / k;
  }
  // Kilograms of dried product from a fresh weight.
  const driedWeight = (kg, mi, mf) => (kg * (100 - mi)) / (100 - mf);

  // Walk the forecast until the clear-day equivalent is used up. Loading after 11 am counts from tomorrow.
  function finishDate(needDays, forecast, hour) {
    if (needDays == null || !forecast.length) return null;
    if (needDays === 0) return { date: forecast[0].date, beyond: false, startsTomorrow: false };
    const startsTomorrow = hour >= 11;
    let left = needDays;
    const list = forecast.slice(startsTomorrow ? 1 : 0);
    for (const day of list) { left -= day.f; if (left <= 0) return { date: day.date, beyond: false, startsTomorrow }; }
    const avg = list.reduce((s, x) => s + x.f, 0) / list.length || 1;
    const last = new Date(list[list.length - 1].date + 'T00:00Z');
    last.setUTCDate(last.getUTCDate() + Math.ceil(left / avg));
    return { date: last.toISOString().slice(0, 10), beyond: true, startsTomorrow };
  }

  // The best morning in the next few days to start a batch: the most drying in the three days that follow.
  function bestStart(F, hour) {
    const h = hour >= 11 ? 1 : 0;
    let bestI = h, bestV = -1;
    for (let i = h; i < Math.min(F.length - 2, 4); i++) {
      const v = F[i].f + F[i + 1].f + F[i + 2].f;
      if (v > bestV + 0.15) { bestV = v; bestI = i; }
    }
    const slow = F.slice(bestI, bestI + 3).filter(d => d.f < 0.55).length;
    return { index: bestI, date: F[bestI] && F[bestI].date, days: bestV, slow };
  }

  root.FFDry = { daysTo, driedWeight, finishDate, bestStart };
})(typeof self !== 'undefined' ? self : globalThis);
