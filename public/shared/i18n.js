/* Client-side translation lookup.
 *
 * Holds the copy for every screen the participant sees except Stage 4's controls and
 * the reveal sentence, which are composed by the Worker per session and translated
 * there instead -- see src/strings-server.js for why that split is a blinding
 * requirement rather than a tidiness one.
 *
 * All three catalogues are imported statically rather than fetched on demand. The
 * alternative would make the consent screen wait on a network round trip before it
 * could redraw itself in the chosen language, and would leave a participant on a poor
 * connection staring at a half-translated page. They are a few kilobytes of text. */

import { DEFAULT_LANGUAGE, normaliseLanguage } from './languages.js';
import en from './strings/en.js';
import si from './strings/si.js';
import ta from './strings/ta.js';

const CATALOGUES = { en, si, ta };

let current = DEFAULT_LANGUAGE;

export function getLanguage() {
  return current;
}

/* Sets the language and tells the browser which script to expect.
 *
 * The `lang` attribute is not decoration. Font fallback, line breaking and the voice a
 * screen reader chooses are all driven by it, and without it a Sinhala page announced
 * as English is read out as gibberish by assistive technology. */
export function setLanguage(code) {
  current = normaliseLanguage(code);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = current;
    ensureScriptFont(current);
  }
  return current;
}

/* ---------------- script fonts ----------------
 *
 * Sinhala and Tamil are loaded on demand, English needs nothing extra, and the system
 * faces in the stylesheet's stack cover the gap until the file arrives.
 *
 * Fetched rather than left to the device on purpose. Nirmala UI on Windows, Noto on
 * Android and the Sangam faces on Apple platforms all render these scripts correctly
 * but not identically, and the participant is being asked to judge a garment on a page
 * set in one of them. Pinning the face keeps that constant across the sample, the same
 * argument the colour pool makes for holding saturation and lightness fixed.
 *
 * The privacy cost was already being paid: index.html loads Inter from the same origin
 * for the shirt print, so this adds no party that was not already in the request log.
 * It is deferred to the point of choosing a language so that the roughly two thirds of
 * participants who never leave English never fetch it. */
const SCRIPT_FONTS = {
  si: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;500;600&display=swap',
  ta: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;500;600&display=swap'
};

const loadedFonts = new Set();

function ensureScriptFont(code) {
  const href = SCRIPT_FONTS[code];
  if (!href || loadedFonts.has(code)) return;
  loadedFonts.add(code);

  /* display=swap in the URL means text is painted in the system face immediately and
     restyled when the download lands, so a slow connection delays nothing. */
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.append(link);
}

/* Looks up a key in a named language, falling back to English and then to the key.
 *
 * Stateless, and that is not a stylistic preference. The Worker imports this module to
 * translate the reveal sentence, and a Worker isolate serves many participants
 * concurrently: a module-level "current language" set at the top of a request would be
 * overwritten by the next request before the first had finished with it, and a Tamil
 * participant would be handed a Sinhala sentence. The browser has exactly one
 * participant and can afford the convenience of `t`; the server must always name the
 * language it means.
 *
 * The fallback chain is deliberately visible rather than silent. An untranslated
 * string shows in English, which is a degraded experience but a usable one; a key that
 * exists in no catalogue at all shows as the key, which is unmistakably a bug and will
 * be caught the first time anyone looks at the screen. Returning an empty string here
 * would hide a missing question behind a blank space, which is the one outcome that
 * could reach the dataset unnoticed. */
export function translate(language, key, vars) {
  const catalogue = CATALOGUES[normaliseLanguage(language)] || en;
  const own = catalogue[key];
  const value = typeof own === 'string' && own.trim() !== '' ? own : en[key] ?? key;

  return vars ? interpolate(value, vars) : value;
}

/* The browser's convenience wrapper: the language is whatever setLanguage last chose. */
export function t(key, vars) {
  return translate(current, key, vars);
}

/* `{name}` placeholders, filled from an object.
 *
 * Word order differs between the three languages -- Sinhala and Tamil both put the
 * verb last -- so a sentence assembled by concatenating fragments in English order
 * cannot be translated correctly. Every sentence is therefore one catalogue entry with
 * its variables named inside it, leaving the translator free to move them. */
export function interpolate(template, vars) {
  return String(template).replace(/\{(\w+)\}/g, (whole, name) =>
    Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : whole
  );
}

/* ---------------- translation coverage ----------------
 *
 * Reported rather than enforced, because the study has to keep working while
 * translations are still coming back from review. English is the reference: a key
 * missing from si or ta falls back and is listed here; a key present in si or ta but
 * absent from en is a stale entry left behind by a rename, which is worth knowing
 * about because it will never be shown to anyone. */

export function missingKeys(code) {
  const catalogue = CATALOGUES[normaliseLanguage(code)] || {};
  return Object.keys(en).filter((key) => {
    const value = catalogue[key];
    return typeof value !== 'string' || value.trim() === '';
  });
}

export function staleKeys(code) {
  const catalogue = CATALOGUES[normaliseLanguage(code)] || {};
  return Object.keys(catalogue).filter((key) => !(key in en));
}

export function catalogueFor(code) {
  return CATALOGUES[normaliseLanguage(code)] || {};
}

export { CATALOGUES };
