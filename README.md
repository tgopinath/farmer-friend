# FarmerFriend · விவசாயி நண்பன்

**Live app: https://farmerfriend.vercel.app**
Open it on a phone and choose *Add to Home Screen* to install it. Switch between English and தமிழ் at the top.

Admin (for adding plants): https://farmerfriend.vercel.app/admin.html

A farming guide for Indian farmers, in English and Tamil: what to plant each season (Kharif, Rabi, Zaid),
step-by-step guides for 78 crops (grains, millets, vegetables, greens, fruits), and 10 organic compost and natural-input recipes with a field-size calculator.
Live weather advice comes from Open-Meteo. Every crop has photos, pest photos and "how to grow" videos, and any other plant can be searched through iNaturalist and Wikipedia.

Every figure was checked against TNAU, ICAR, NHB and Government of India sources (506 claims; see the
in-app accuracy report at `#/sources`). It is general guidance; farmers should confirm with their local KVK.

Plain HTML/CSS/JS, no build step. Run locally with `python3 -m http.server` and open http://localhost:8000.

- `data-crops.js`, `data-compost.js`: English data · `data-ta-*.js`: Tamil translations · `i18n.js`: interface text
- `sources.js`: references and accuracy report · `tools/check-ta.mjs`: checks Tamil data matches the English
