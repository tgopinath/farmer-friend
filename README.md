# FarmerFriend · விவசாயி நண்பன்

A farming guide for Indian farmers, in English and Tamil: what to plant each season (Kharif, Rabi, Zaid),
step-by-step guides for 30 crops, and 10 organic compost and natural-input recipes with a field-size calculator.
Live weather advice comes from Open-Meteo.

Every figure was checked against TNAU, ICAR, NHB and Government of India sources (506 claims; see the
in-app accuracy report at `#/sources`). It is general guidance; farmers should confirm with their local KVK.

Plain HTML/CSS/JS, no build step. Run locally with `python3 -m http.server` and open http://localhost:8000.

- `data-crops.js`, `data-compost.js`: English data · `data-ta-*.js`: Tamil translations · `i18n.js`: interface text
- `sources.js`: references and accuracy report · `tools/check-ta.mjs`: checks Tamil data matches the English
