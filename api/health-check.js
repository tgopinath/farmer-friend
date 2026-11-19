// POST /api/health-check  { imageBase64, mediaType, species?, notes?, lang? }  →  { result }
// Sick-animal screening from one photo, using Claude's vision (moved from Farm Manager's server, same prompt and schema).
// A screening aid, not a diagnosis: it reports what is visible and how urgently a vet should look.
// The key lives only in the Vercel project (ANTHROPIC_API_KEY). Without it the route answers with a clearly
// marked sample result, so the app can be tried end to end. Requests are rate-limited per visitor.
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { json } from './_store.js';

const MODEL = process.env.FARM_AI_MODEL || 'claude-opus-5';
const MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_B64 = 5_600_000; // about a 4 MB photo; the app sends a 1024 px JPEG well under this

export const Assessment = z.object({
  animalVisible: z.boolean().describe('Whether a goat, cow or chicken is clearly visible'),
  species: z.enum(['goat', 'cow', 'chicken', 'other', 'unknown']),
  status: z.enum(['looks_healthy', 'possible_concern', 'likely_sick', 'urgent']),
  confidence: z.enum(['low', 'medium', 'high']),
  signs: z.array(z.object({
    sign: z.string().describe('A visible sign, e.g. "nasal discharge", "hunched posture"'),
    where: z.string().describe('Body area'),
  })),
  possibleConditions: z.array(z.string()).describe('Common conditions consistent with the signs, most likely first'),
  advice: z.array(z.string()).describe('Practical next steps for the farmer'),
  callVet: z.boolean(),
  summary: z.string().describe('One or two plain sentences for the farmer'),
});

const SYSTEM = `You help small farmers in India screen goats, cows and chickens for illness from a phone or CCTV photo.

Look only at what is visible: body condition, posture, coat or feathers, eyes, nose, mouth, legs and hooves or feet, skin lesions, swelling, wounds, discharge, droppings in view, and the animal's surroundings.

Be honest about the limits of a single photo. If the image is blurry, too dark, or no animal is visible, say so with low confidence rather than guessing. You are a screening aid, not a vet: when anything suggests a contagious disease (e.g. foot-and-mouth, PPR, lumpy skin, Newcastle disease, avian influenza), sudden deaths, bleeding, inability to stand, or labour difficulty, set callVet to true and status to urgent.

Write advice a farmer can act on today, in simple words.`;

// The sample answer shown when no key is set (marked demo so the app labels it).
const DEMO = {
  en: { animalVisible: true, species: 'goat', status: 'possible_concern', confidence: 'low', callVet: false,
    signs: [{ sign: 'Dull, rough coat', where: 'Body' }, { sign: 'Slight discharge at the nose', where: 'Nose' }],
    possibleConditions: ['Mild respiratory infection', 'Worm load'],
    advice: ['Keep the animal in a dry, airy shed away from the herd', 'Check its temperature morning and evening', 'Call the vet if it stops eating or the discharge thickens'],
    summary: 'Sample answer: this is what a real check returns. The photo was not analysed.' },
  ta: { animalVisible: true, species: 'goat', status: 'possible_concern', confidence: 'low', callVet: false,
    signs: [{ sign: 'மங்கிய, சொரசொரப்பான உரோமம்', where: 'உடல்' }, { sign: 'மூக்கில் லேசான சளி', where: 'மூக்கு' }],
    possibleConditions: ['லேசான சுவாசத் தொற்று', 'குடற்புழுத் தொல்லை'],
    advice: ['மந்தையிலிருந்து பிரித்து, உலர்ந்த காற்றோட்டமுள்ள கொட்டகையில் வையுங்கள்', 'காலையும் மாலையும் உடல் வெப்பநிலையைப் பாருங்கள்', 'தீனி எடுக்காவிட்டால் அல்லது சளி கெட்டியானால் மருத்துவரை அழையுங்கள்'],
    summary: 'மாதிரிப் பதில்: உண்மையான சோதனை இப்படித்தான் பதில் தரும். படம் ஆய்வு செய்யப்படவில்லை.' },
};

// A small in-memory limiter: 6 checks per visitor per 10 minutes and 60 per instance per hour.
// Vercel may run several instances, so this bounds cost per instance; the hard cap is the key's own spend limit.
const hits = new Map();
let hourStart = Date.now(), hourCount = 0;
function limited(ip) {
  const now = Date.now();
  if (now - hourStart > 3600e3) { hourStart = now; hourCount = 0; }
  const list = (hits.get(ip) || []).filter(t => now - t < 600e3);
  if (list.length >= 6 || hourCount >= 60) return true;
  list.push(now); hits.set(ip, list); hourCount++;
  if (hits.size > 5000) hits.clear();
  return false;
}

let client = null;
export async function POST(req) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'unknown';
  if (limited(ip)) return json({ error: 'Too many checks. Try again in a few minutes.' }, 429, { 'retry-after': '600' });
  let body;
  try { body = await req.json(); } catch { return json({ error: 'Send JSON.' }, 400); }
  const { imageBase64, mediaType = 'image/jpeg', species, notes, lang } = body || {};
  if (typeof imageBase64 !== 'string' || imageBase64.length < 100) return json({ error: 'Send a photo.' }, 400);
  if (imageBase64.length > MAX_B64) return json({ error: 'That photo is too large.' }, 413);
  if (!MEDIA.has(mediaType)) return json({ error: 'Use a JPEG, PNG, WebP or GIF photo.' }, 415);
  const ta = lang === 'ta';
  if (!(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN)) return json({ result: { ...DEMO[ta ? 'ta' : 'en'], demo: true } });

  const context = [
    ['goat', 'cow', 'chicken'].includes(species) ? `The farmer says this is a ${species}.` : null,
    typeof notes === 'string' && notes.trim() ? `Farmer's notes: ${notes.trim().slice(0, 500)}` : null,
    ta ? 'Write every text field (signs, where, possibleConditions, advice, summary) in simple, natural Tamil.' : 'Write in simple English.',
    "Assess this animal's visible health.",
  ].filter(Boolean).join('\n');
  try {
    client ??= new Anthropic();
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system: SYSTEM,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        { type: 'text', text: context },
      ] }],
      output_config: { effort: 'medium', format: betaZodOutputFormat(Assessment) },
    });
    if (response.stop_reason === 'refusal') return json({ error: 'The photo could not be assessed.' }, 422);
    if (!response.parsed_output) return json({ error: 'The assessment came back incomplete. Try again.' }, 502);
    return json({ result: { ...response.parsed_output, model: response.model } });
  } catch (e) {
    const status = e?.status === 429 ? 429 : e?.status === 400 ? 400 : 502;
    return json({ error: status === 429 ? 'The AI service is busy. Try again in a minute.' : 'The check failed. Try again.' }, status);
  }
}
