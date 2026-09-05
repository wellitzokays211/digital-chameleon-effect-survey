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
 * is rendering.
 *
 * A second split runs across this one. What is here is structure -- which hues exist,
 * which answers are accepted, how many points the scale has. The words wrapped around
 * that structure are in public/shared/strings/, one file per language, because they
 * exist three times over and this file must not be the place where the English happens
 * to also live. Anything with a reading age belongs there, not here. */

import { hslToHex } from './colour.js';

/* ---------------- colour pool ----------------
 *
 * The ten hues carried by the prototype, at one shared saturation and lightness so
 * they differ only in hue. Holding S and L constant is what makes a colour-preference
 * choice attributable to hue rather than to one swatch simply being brighter than the
 * others. The prototype's "Original" and "White" swatches are excluded: "Original" is
 * the undyed photograph rather than a hue, and White has almost no saturation, so
 * neither belongs in a ten-hue comparison.
 *
 * The `id` is the stored value and the translation key. There is no `name` here: the
 * reveal sentence names one of these back to the participant in their own language,
 * so an English name on the object would be a second source of truth for something
 * that already has one in every catalogue. Look them up with `colour.<id>`. */

const POOL_SATURATION = 0.647;
const POOL_LIGHTNESS = 0.5;

export const COLOUR_POOL = [
  { id: 'red_orange', h: 17.3 },
  { id: 'orange', h: 35.5 },
  { id: 'yellow_gold', h: 61.3 },
  { id: 'green', h: 125.4 },
  { id: 'teal', h: 179.2 },
  { id: 'blue', h: 210.9 },
  { id: 'blue_violet', h: 241.8 },
  { id: 'magenta', h: 306.9 },
  { id: 'pink_magenta', h: 324.3 },
  { id: 'pink_red', h: 340.3 }
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

/* The translation key for a hue, in one place so no caller has to remember the prefix
 * and mistype it into a key that silently renders as itself. */
export function colourKey(colour) {
  return `colour.${typeof colour === 'string' ? colour : colour?.id}`;
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

/* Formats the ranges for the ineligibility message rather than having three catalogues
 * each type the four years out. Moving a range then cannot leave a translation quoting
 * the old one, which is the sort of drift nobody notices until a participant is turned
 * away by a message that contradicts the check that turned them away. */
export function birthYearRangesText(join) {
  return BIRTH_YEAR_RANGES.map((r) => `${r.min}\u2013${r.max}`).join(join);
}

export function isEligibleBirthYear(year) {
  const y = Number(year);
  if (!Number.isInteger(y)) return false;
  return BIRTH_YEAR_RANGES.some((r) => y >= r.min && y <= r.max);
}

/* ---------------- Stage 2: onboarding ----------------
 *
 * The gender values stay in English because they are stored data, not copy: they are
 * written to the response document, drive model selection on the server and end up as
 * a column in the export. Translating the value as well as the label would split one
 * variable into three spellings and make the dataset a merge problem. Labels come from
 * `gender.<value>`. */

export const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];

/* Likewise the experience answers are stored as their numbers. Labels are `ex1.<n>`
 * and `ex2.<n>`. */
export const EX1_VALUES = [1, 2, 3, 4, 5];
export const EX2_VALUES = [1, 2, 3, 4, 5];

/* ---------------- Stage 5: questionnaire ---------------- */

export const LIKERT_MIN = 1;
export const LIKERT_MAX = 7;

/* Ids only. The statements themselves are `item.<id>` in the catalogues, because a
 * translated scale item is the single most consequential string in the study and
 * having it here in English as well would invite the two copies to diverge. */
export const QUESTIONNAIRE_ITEM_IDS = [
  'pin1',
  'pin2',
  'pin3',
  'po1',
  'po2',
  'po3',
  'pa1',
  'cp1'
];

/* ---------------- progress indicator ----------------
 *
 * The reveal shares the calibration step number. It is a short transitional screen,
 * and giving it a number of its own would hint that something of substance sits
 * between choosing colours and the task. */

export const TOTAL_STEPS = 5;

export const STEP_NUMBERS = {
  consent: 1,
  onboarding: 2,
  calibration: 3,
  reveal: 3,
  treatment: 4,
  questionnaire: 5
};

/* The loading screen is a fixed floor rather than a fixed duration: the first garment
 * has to finish its precomputation before the reveal can show it. Identical for every
 * participant either way, which is what the brief requires. */
export const LOADING_FLOOR_MS = 1400;
