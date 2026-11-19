// One weather fetch for the whole app (Open-Meteo, free, no key).
// The same reply feeds the Today advice (FarmerFriend), the soil water balance (Water) and drying dates (Drying):
// 30 days back for the water balance, today and 15 days ahead for planning.
(function (root) {
  const FIELDS = {
    current: 'temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m,cloud_cover,shortwave_radiation,is_day,precipitation',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,precipitation_probability_max,et0_fao_evapotranspiration,relative_humidity_2m_mean,shortwave_radiation_sum,cloud_cover_mean,sunrise,sunset',
  };
  const url = p => 'https://api.open-meteo.com/v1/forecast?latitude=' + p.lat + '&longitude=' + p.lon +
    '&current=' + FIELDS.current + '&daily=' + FIELDS.daily + '&timezone=auto&past_days=30&forecast_days=16';

  // Index of today in the daily arrays (the reply starts 30 days back).
  function todayIndex(d) {
    const t = (d.current && d.current.time || '').slice(0, 10);
    const i = d.daily.time.indexOf(t);
    return i >= 0 ? i : Math.min(30, d.daily.time.length - 1);
  }
  // The daily arrays from today on, so code written for a plain forecast reads index 0 as today.
  function ahead(d, n) {
    const i = todayIndex(d), out = {};
    for (const k in d.daily) out[k] = d.daily[k].slice(i, n ? i + n : undefined);
    return { current: d.current, daily: out };
  }
  const val = (a, i, dflt) => (a && a[i] != null ? a[i] : dflt);

  // Rows for the soil water balance: past days are what happened, the rest are forecast.
  function waterDays(d) {
    const dl = d.daily, today = dl.time[todayIndex(d)];
    return dl.time.map((t, i) => ({
      date: t, code: dl.weather_code[i], tmax: dl.temperature_2m_max[i], tmin: dl.temperature_2m_min[i],
      rain: val(dl.precipitation_sum, i, 0), prob: val(dl.precipitation_probability_max, i, null),
      et0: val(dl.et0_fao_evapotranspiration, i, 0), past: t < today, today: t === today,
    })).filter(x => x.tmax != null);
  }

  // Rows for drying: today and the days ahead, with what the inside of a dry house is likely to reach.
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // Air in the house runs 15–25 °C above outside on a sunny day; the rise follows sunshine.
  const houseRise = radMJ => clamp(25 * (radMJ / 22), 3, 28);
  const houseRiseNow = wm2 => clamp(25 * (wm2 / 850), 0, 28);
  // Heating air by about 11 °C halves its relative humidity.
  const houseRH = (rh, rise) => clamp(rh * Math.pow(2, -rise / 11), 5, 100);
  // How fast drying runs on a day compared with a clear reference day (1.0).
  function dayFactor(day) {
    const sun = Math.pow(clamp(day.rad / 20, 0, 1.4), 0.9);
    const humid = clamp(1 - 0.008 * (day.rh - 65), 0.6, 1.15);
    return clamp(sun * humid, 0.1, 1.3);
  }
  const rating = f => (f >= 0.85 ? 'good' : f >= 0.55 ? 'fair' : 'poor');
  function dryDays(d) {
    const dl = d.daily, from = todayIndex(d), out = [];
    for (let i = from; i < dl.time.length; i++) {
      const day = {
        date: dl.time[i], code: dl.weather_code[i], tmax: dl.temperature_2m_max[i], tmin: dl.temperature_2m_min[i],
        rh: val(dl.relative_humidity_2m_mean, i, null), rad: val(dl.shortwave_radiation_sum, i, 0),
        rain: val(dl.precipitation_probability_max, i, 0), cloud: val(dl.cloud_cover_mean, i, 0),
        sunrise: val(dl.sunrise, i, ''), sunset: val(dl.sunset, i, ''),
      };
      if (day.tmax == null || day.rh == null) continue;
      day.rise = houseRise(day.rad);
      day.house = day.tmax + day.rise;
      day.houseRH = houseRH(day.rh * 0.7, day.rise);
      day.f = dayFactor(day);
      out.push(day);
    }
    return out;
  }

  // Weather code to a word key and an icon in the sprite.
  const WMO = [
    [[0], 'clear', 'sun'], [[1, 2], 'partly', 'cloud'], [[3], 'overcast', 'cloud'], [[45, 48], 'fog', 'fog'],
    [[51, 53, 55, 56, 57], 'drizzle', 'rain'], [[61, 63, 65, 66, 67, 80, 81, 82], 'rain', 'rain'], [[71, 73, 75, 77, 85, 86], 'snow', 'cloud'], [[95, 96, 99], 'storm', 'storm'],
  ];
  const code = c => { const r = WMO.find(([cs]) => cs.includes(c)) || WMO[1]; return { word: r[1], icon: r[2] }; };

  root.FFWx = { url, todayIndex, ahead, waterDays, dryDays, houseRise, houseRiseNow, houseRH, dayFactor, rating, code };
})(typeof self !== 'undefined' ? self : globalThis);
