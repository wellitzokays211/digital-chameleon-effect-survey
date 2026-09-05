/* Writes every participant-facing string to one CSV for native-speaker review.
 *
 *   node tools/export-strings.mjs [outfile]
 *
 * The Sinhala and Tamil in this project were produced by an AI assistant. That is fine
 * for building against and not fine for collecting data against, so this exists to get
 * all of it in front of someone who actually reads the language, in one place, with the
 * English beside it and an empty column to correct it in.
 *
 * Two things the reviewer needs that a bare dump would not give them.
 *
 * A priority, because the strings are not equally consequential. Getting "Continue"
 * slightly wrong costs nothing; getting a scale item slightly wrong changes what the
 * study measured, and getting the consent body wrong is an ethics problem rather than a
 * translation one. Those are marked so a reviewer with an hour spends it in the right
 * place.
 *
 * A note, wherever the English is carrying a constraint the Sinhala or Tamil also has
 * to carry -- a placeholder that must survive, two strings that have to stay matched in
 * weight, a badge with almost no room in it. A reviewer cannot infer those from the
 * sentence, and they are exactly the corrections that come back subtly wrong. */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { LANGUAGE_CODES } from '../public/shared/languages.js';
import { catalogueFor } from '../public/shared/i18n.js';
import { ALL_SERVER_STRINGS } from '../src/strings-server.js';

const outPath = path.resolve(process.argv[2] || 'exports/translations-for-review.csv');

/* ---------------- what each key is, and how much it matters ---------------- */

/* instrument: changing it changes what the study measures or what was consented to.
   layout:     correct but long breaks the screen it sits in.
   normal:     ordinary interface copy. */
function classify(key) {
  if (key.startsWith('item.')) {
    return ['instrument', 'Validated scale item. Needs forward and back translation, not proofreading: if this reads stronger or weaker than the English, language is confounded with the experimental conditions.'];
  }
  if (key.startsWith('consent.')) {
    return ['instrument', 'Ethics document. This must match whatever wording the ethics committee approved for this language, word for word.'];
  }
  if (key.startsWith('reveal.') && /Clause|stem/.test(key)) {
    return ['instrument', 'Part of the experimental manipulation. The liked and disliked clauses must stay matched in length and tone; a difference between them is a difference between conditions.'];
  }
  if (key.startsWith('questionnaire.likert')) {
    return ['instrument', 'Scale anchor. The distance between the two anchors defines what the midpoint means, so both ends must be equally strong.'];
  }
  if (key.startsWith('colour.')) {
    return ['instrument', 'One of ten hues that differ only by name. All ten must stay distinguishable from each other; if two share a word, two different treatments get described identically.'];
  }
  if (key === 'changes.skinTone') {
    return ['instrument', 'The instruction that makes skin-tone matching an instruction followed rather than a preference revealed. It must still ask the participant to match their own tone.'];
  }
  if (key === 'calibration.locked') {
    return ['layout', 'Printed inside a colour swatch with a second line under it. Very little room: if it wraps badly on a phone, a shorter word is better than a literal one.'];
  }
  if (key.startsWith('control.sleeve.') || key.startsWith('control.neck.')) {
    return ['layout', 'Sits in a row of two or three equal-width buttons. Long labels wrap and make the row ragged.'];
  }
  if (key.startsWith('stage4.') && key.endsWith('Hint')) {
    return ['instrument', 'The two Stage 4 hints must invite the same amount of lingering as each other, because the time participants take is compared between them.'];
  }
  return ['normal', ''];
}

function placeholderNote(english) {
  const found = String(english).match(/\{\w+\}/g);
  if (!found) return '';
  return `Must keep ${found.join(' and ')} exactly as written; the text is inserted there at runtime.`;
}

/* ---------------- gather ---------------- */

const rows = [];

/* client catalogues, flat */
const clientEnglish = catalogueFor('en');
for (const key of Object.keys(clientEnglish)) {
  rows.push({ key, area: 'Screens', english: clientEnglish[key], get: (c) => catalogueFor(c)[key] });
}

/* server catalogue, flattened to the same shape */
function walkServer(node, trail) {
  for (const [key, value] of Object.entries(node)) {
    const dotted = [...trail, key];
    if (typeof value === 'string') {
      const flat = dotted.join('.');
      rows.push({
        key: flat,
        area: trail[0] === 'control' ? 'Stage 4 controls' : 'Reveal and customisation',
        english: value,
        get: (c) => dotted.reduce((o, k) => o?.[k], ALL_SERVER_STRINGS[c])
      });
      continue;
    }
    walkServer(value, dotted);
  }
}
walkServer(ALL_SERVER_STRINGS.en, []);

/* ---------------- write ---------------- */

const header = [
  'Key',
  'Area',
  'Priority',
  'English',
  'Sinhala (draft)',
  'Sinhala (corrected)',
  'Tamil (draft)',
  'Tamil (corrected)',
  'What the reviewer needs to know'
];

/* Quoted unconditionally. Half of these sentences contain a comma and several contain a
 * quotation mark, and a reviewer opening a mangled file in Excel will not realise the
 * columns have slipped rather than the translation being wrong. */
function cell(value) {
  return `"${String(value ?? '').replace(/"/g, '""')}"`;
}

const lines = [header.map(cell).join(',')];

for (const row of rows) {
  const [priority, note] = classify(row.key);
  const notes = [note, placeholderNote(row.english)].filter(Boolean).join(' ');
  lines.push([
    row.key,
    row.area,
    priority,
    row.english,
    row.get('si') ?? '',
    '',
    row.get('ta') ?? '',
    '',
    notes
  ].map(cell).join(','));
}

await mkdir(path.dirname(outPath), { recursive: true });
/* BOM, or Excel opens a file that is almost entirely non-Latin as mojibake and the
 * reviewer concludes the translation is broken rather than the encoding. */
await writeFile(outPath, '\uFEFF' + lines.join('\r\n') + '\r\n', 'utf8');

/* ---------------- report ---------------- */

const byPriority = new Map();
for (const row of rows) {
  const [priority] = classify(row.key);
  byPriority.set(priority, (byPriority.get(priority) || 0) + 1);
}

console.log(`\n  Wrote ${outPath}`);
console.log(`    ${rows.length} strings, ${LANGUAGE_CODES.length} languages\n`);
for (const [priority, count] of [...byPriority].sort()) {
  console.log(`    ${String(count).padStart(3)}  ${priority}`);
}
console.log(
  '\n  Start with the "instrument" rows. Those are the ones where a plausible-looking\n' +
  '  translation still changes the study.\n'
);
