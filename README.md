# FarmerFriend · விவசாயி நண்பன்

**Live app: https://farmerfriend.vercel.app**
Open it on a phone and choose *Add to Home Screen* to install it. Switch between English and தமிழ் at the top.

Admin (for adding plants): https://farmerfriend.vercel.app/admin.html

One farm app for Indian farmers, in English and Tamil. It combines four apps that used to be separate:

- **Today on your farm**: live weather with farm advice and one ranked "Needs attention" list from every section.
- **Crops & seasons**: what to plant each season (Kharif, Rabi, Zaid) and step-by-step guides for 78 crops, with photos, pest photos and videos; any other plant through iNaturalist and Wikipedia.
- **Organic inputs**: 10 compost and natural-input recipes with a field-size calculator.
- **Water** (was Water Manager): which field to water today from a daily soil water balance, rain and borewell recharge, water and pump use.
- **Drying** (was Solar Dry House): drying weather, 58 materials with ready dates from the forecast, a batch planner and a guide.
- **Livestock & farm books** (was Farm Manager): animals, money and accounts, feed and stock days left, upkeep, vaccinations and a photo health check (AI screening; set `ANTHROPIC_API_KEY` in Vercel, otherwise it shows a marked sample answer).

The app opens with a sample farm so every section can be tried; Settings starts an empty farm or backs it up.

Every figure was checked against TNAU, ICAR, NHB and Government of India sources (506 claims; see the
in-app accuracy report at `#/sources`). It is general guidance; farmers should confirm with their local KVK.

Plain HTML/CSS/JS, no build step. Run locally with `python3 -m http.server` and open http://localhost:8000.

- `data-crops.js`, `data-compost.js`: English data · `data-ta-*.js`: Tamil translations · `i18n.js`: interface text
- `sources.js`: references and accuracy report · `tools/check-ta.mjs`: checks Tamil data matches the English
- `lib/`: water, drying, farm books and Needs-attention logic · `views-*.js`: the new sections · `i18n-more.js`: their text in English and Tamil
- Checks: `node --test tests/*.mjs`, `node tools/check-crops.mjs`, `node tools/check-ta.mjs`, `node tools/smoke.mjs` (every screen, EN and Tamil, web/Android/iOS looks)

How it is built (system, data flow, shells, deploy): [ARCHITECTURE.md](ARCHITECTURE.md)
