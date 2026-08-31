/* Client-safe study configuration.
 *
 * This file is served to the browser, so it deliberately contains nothing about the
 * experimental design. No condition names, no level numbers, no cell map, no
 * allocation targets. A participant who opens devtools and reads every byte of it
 * learns only what they are already being shown on screen.
 *
 * Everything that would reveal the design lives in src/study-design.js, which is
 * bundled into the Worker and never served. The blinding requirement is why the split
 * exists: the frontend is told "customisation is available / is not available" and is
 * handed whatever controls it is allowed to have, never which of the twelve cells it
 * is rendering. */

import { hslToHex } from './colour.js';

/* ---------------- colour pool ----------------
 *
 * The ten hues carried by the prototype, at one shared saturation and lightness so
 * they differ only in hue. Holding S and L constant is what makes a colour-preference
 * choice attributable to hue rather than to one swatch simply being brighter than the
 * others. The prototype's "Original" and "White" swatches are excluded: "Original" is
 * the undyed photograph rather than a hue, and White has almost no saturation, so
 * neither belongs in a ten-hue comparison. */

const POOL_SATURATION = 0.647;
const POOL_LIGHTNESS = 0.5;

export const COLOUR_POOL = [
  { id: 'red_orange', name: 'red-orange', h: 17.3 },
  { id: 'orange', name: 'orange', h: 35.5 },
  { id: 'yellow_gold', name: 'yellow-gold', h: 61.3 },
  { id: 'green', name: 'green', h: 125.4 },
  { id: 'teal', name: 'teal', h: 179.2 },
  { id: 'blue', name: 'blue', h: 210.9 },
  { id: 'blue_violet', name: 'blue-violet', h: 241.8 },
  { id: 'magenta', name: 'magenta', h: 306.9 },
  { id: 'pink_magenta', name: 'pink-magenta', h: 324.3 },
  { id: 'pink_red', name: 'pink-red', h: 340.3 }
].map((c) => ({
  ...c,
  s: POOL_SATURATION,
  l: POOL_LIGHTNESS,
  hex: hslToHex(c.h, POOL_SATURATION, POOL_LIGHTNESS)
}));

export function colourByHex(hex) {
  if (!hex) return null;
  const target = String(hex).toLowerCase();
  return COLOUR_POOL.find((c) => c.hex.toLowerCase() === target) || null;
}

/* ---------------- eligibility ----------------
 *
 * The ranges are client-side because the participant is shown the message that names
 * them anyway. Which generation a year maps to is not: that label is derived on the
 * server and never sent back. */

export const BIRTH_YEAR_RANGES = [
  { min: 1965, max: 1980 },
  { min: 1997, max: 2008 }
];

export const INELIGIBLE_BIRTH_YEAR_MESSAGE =
  'This study is currently only open to participants born between 1965\u20131980 or 1997\u20132008.';

export function isEligibleBirthYear(year) {
  const y = Number(year);
  if (!Number.isInteger(y)) return false;
  return BIRTH_YEAR_RANGES.some((r) => y >= r.min && y <= r.max);
}

/* ---------------- Stage 2: onboarding ---------------- */

export const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];

export const EX1_OPTIONS = [
  { value: 1, label: 'Less than 1 year' },
  { value: 2, label: '1\u20132 years' },
  { value: 3, label: '3\u20135 years' },
  { value: 4, label: '6\u20139 years' },
  { value: 5, label: '10 years or more' }
];

export const EX2_OPTIONS = [
  { value: 1, label: 'Rarely, a few times a year' },
  { value: 2, label: 'Every few months' },
  { value: 3, label: 'Monthly' },
  { value: 4, label: 'Weekly' },
  { value: 5, label: 'Several times a week' }
];

/* ---------------- Stage 5: questionnaire ---------------- */

export const LIKERT_MIN = 1;
export const LIKERT_MAX = 7;
export const LIKERT_MIN_LABEL = 'Strongly disagree';
export const LIKERT_MAX_LABEL = 'Strongly agree';

export const QUESTIONNAIRE_ITEMS = [
  { id: 'pin1', text: 'I would buy this T-shirt if I had the chance.' },
  { id: 'pin2', text: 'I will probably buy this T-shirt at some point.' },
  { id: 'pin3', text: 'I am willing to buy the T-shirt exactly as I just saw it.' },
  { id: 'po1', text: 'This feels like my T-shirt.' },
  { id: 'po2', text: 'I feel a strong sense of owning this T-shirt.' },
  { id: 'po3', text: 'This T-shirt feels like it belongs to me.' },
  { id: 'pa1', text: 'I felt like I was in control of how this T-shirt looked.' },
  { id: 'cp1', text: 'I like the colour of this T-shirt.' }
];

/* ---------------- progress indicator ----------------
 *
 * The reveal shares the calibration step number. It is a short transitional screen,
 * and giving it a number of its own would hint that something of substance sits
 * between choosing colours and the task. */

export const STEP_LABELS = {
  consent: 'Step 1 of 5',
  onboarding: 'Step 2 of 5',
  calibration: 'Step 3 of 5',
  reveal: 'Step 3 of 5',
  treatment: 'Step 4 of 5',
  questionnaire: 'Step 5 of 5'
};

/* The loading screen is a fixed floor rather than a fixed duration: the first garment
 * has to finish its precomputation before the reveal can show it. Identical for every
 * participant either way, which is what the brief requires. */
export const LOADING_FLOOR_MS = 1400;

/* ---------------- copy ---------------- */

export const CONSENT_TEXT =
  'This study is conducted as part of a BSc (Hons) dissertation at the University of ' +
  'Kelaniya. Your participation is entirely voluntary and you may withdraw at any time ' +
  'by closing the browser. All responses are anonymised; your email address is collected ' +
  'solely for duplicate-response control, stored separately from your answers, and ' +
  'deleted once data collection closes. No personally identifiable information will ' +
  'appear in the final report. By clicking \u2018I agree and proceed\u2019 you confirm that you ' +
  'are 18 years of age or older and consent to participate.';

export const MESSAGES = {
  duplicate: 'It looks like you\u2019ve already participated in this study. Thank you again for your time.',
  studyFull: 'This study is no longer accepting responses, thank you for your interest.',
  thanks: 'Thank you for participating.',
  declined: 'Thank you for your time. You may now close this window.',
  genericError: 'Something went wrong saving your response. Please check your connection and try again.'
};
