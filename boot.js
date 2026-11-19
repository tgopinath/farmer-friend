// Start the app once every section has loaded: first route, admin-added plants, the weather and offline support.
route();
loadCustomPlants();
fetchWeather().catch(() => {});
addEventListener('visibilitychange', () => { const w = weatherNow(); if (!document.hidden && w && Date.now() - w.t > 60 * 60e3) fetchWeather(true).then(rerender).catch(() => {}); });
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
