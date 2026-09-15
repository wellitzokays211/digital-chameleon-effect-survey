/* Flatten the completed responses into one CSV row per participant.
 *
 * The stored document is not a rectangle. `customisation` is a nested object whose keys
 * depend on the assigned level -- absent at Level 1, without skin tone at Level 2 -- so
 * feeding the raw JSON to SPSS or R gives you either an error or a column that silently
 * means different things in different rows. This writes a fixed set of columns, present
 * for every participant and empty where the control was never shown, which is the
 * distinction that matters: empty means "not offered", not "offered and not used".
 *
 * Booleans come out as 1/0 rather than true/false, because SPSS reads those as numeric
 * without an import step.
 *
 * Usage (PowerShell):
 *   $env:ADMIN_TOKEN = "your admin token"
 *   node tools/export-csv.mjs --url https://tshirt.YOUR-SUBDOMAIN.workers.dev
 *
 * Or from a file you already downloaded:
 *   node tools/export-csv.mjs --file backup.json
 *
 * Writes exports/responses.csv, which is git-ignored: participant data does not belong
 * in a repository even without identifiers in it.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
const argValue = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const url = argValue('--url');
const file = argValue('--file');
const outPath = argValue('--out') || path.join('exports', 'responses.csv');

if (!url && !file) {
  console.error('\n  Give it somewhere to read from:\n');
  console.error('    node tools/export-csv.mjs --url https://your-worker.workers.dev');
  console.error('    node tools/export-csv.mjs --file backup.json\n');
  console.error('  With --url, set ADMIN_TOKEN in the environment first.\n');
  process.exit(1);
}

/* ---------------- load ---------------- */

let responses;

if (file) {
  const text = await readFile(file, 'utf8');
  const parsed = JSON.parse(text);
  responses = Array.isArray(parsed) ? parsed : parsed.responses;
} else {
  const token = process.env.ADMIN_TOKEN;
  if (!token) {
    console.error('\n  ADMIN_TOKEN is not set in this shell.');
    console.error('  PowerShell:  $env:ADMIN_TOKEN = "your admin token"\n');
    process.exit(1);
  }
  const res = await fetch(url.replace(/\/$/, '') + '/api/admin/export', {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    console.error(`\n  Export failed: ${res.status} ${await res.text()}\n`);
    if (res.status === 401) console.error('  The admin token does not match the deployed one.\n');
    process.exit(1);
  }
  responses = (await res.json()).responses;
}

if (!Array.isArray(responses)) {
  console.error('\n  No responses array found in the data.\n');
  process.exit(1);
}

/* ---------------- shape ----------------
 *
 * Column order is grouped the way you will read it: who they are, what the design did to
 * them, what they produced, then what they answered. */

const mean = (values) => {
  const nums = values.filter((v) => typeof v === 'number' && Number.isFinite(v));
  return nums.length ? Math.round((nums.reduce((a, b) => a + b, 0) / nums.length) * 1000) / 1000 : '';
};

const bool = (v) => (v === true ? 1 : v === false ? 0 : '');

const COLUMNS = [
  /* identity and design */
  ['sessionId', (r) => r.sessionId],
  ['cellId', (r) => r.cellId],
  ['generation', (r) => r.generation],
  ['condition', (r) => r.assignedCondition],
  ['level', (r) => r.assignedLevel],

  /* demographics */
  ['birthYear', (r) => r.birthYear],
  ['gender', (r) => r.gender],
  /* The language the participant consented, read the scale and answered in.
   *
   * Not a preference but a property of the measurement: the eight items are a
   * translated instrument, so two participants who answered in different languages did
   * not strictly answer the same question. Worth checking for imbalance across the
   * twelve cells before treating it as noise, since nothing in the randomisation
   * balances it. Empty for any session started before the picker existed. */
  ['language', (r) => r.language || ''],
  ['onlineShoppingYears', (r) => r.ex1],
  ['purchaseFrequency', (r) => r.ex2],

  /* calibration */
  ['likedColourHex', (r) => r.likedColourHex],
  ['dislikedColourHex', (r) => r.dislikedColourHex],
  /* The colour they were actually shown, which is the manipulation itself and is
     otherwise only implicit in condition + the two calibration columns. */
  ['shownColourHex', (r) => (r.assignedCondition === 'Liked' ? r.likedColourHex : r.dislikedColourHex)],

  /* task */
  ['stage4Seconds', (r) => r.stage4CompletionSeconds],
  ['flaggedFast', (r) => bool(r.flaggedFast)],

  /* customisation values, empty where the control was never shown */
  ['custText', (r) => r.customisation?.text ?? ''],
  ['custTextColour', (r) => r.customisation?.textColour ?? ''],
  ['custFontSizePx', (r) => r.customisation?.fontSizePx ?? ''],
  ['custTextPosX', (r) => r.customisation?.textPosition?.cxFrac ?? ''],
  ['custTextPosY', (r) => r.customisation?.textPosition?.cyFrac ?? ''],
  ['custSleeveLength', (r) => r.customisation?.sleeveLength ?? ''],
  ['custNeckType', (r) => r.customisation?.neckType ?? ''],
  ['custSkinTone', (r) => r.customisation?.skinTone ?? ''],
  ['custSkinToneDefault', (r) => r.customisation?.skinToneDefault ?? ''],

  /* engagement */
  ['textEdited', (r) => bool(r.customisation?.textEdited)],
  ['sleeveChanged', (r) => bool(r.customisation?.sleeveChanged)],
  ['neckChanged', (r) => bool(r.customisation?.neckChanged)],
  ['skinToneAdjusted', (r) => bool(r.customisation?.skinToneAdjusted)],
  ['engagementIndex', (r) => r.customisation?.engagementIndex ?? ''],

  /* dependent variables, item by item */
  ['pin1', (r) => r.pin1],
  ['pin2', (r) => r.pin2],
  ['pin3', (r) => r.pin3],
  ['po1', (r) => r.po1],
  ['po2', (r) => r.po2],
  ['po3', (r) => r.po3],
  ['pa1', (r) => r.pa1],
  ['cp1', (r) => r.cp1],

  /* scale means, for convenience only -- the items above remain the source of truth,
     so you can still run your own reliability analysis before trusting these. */
  ['purchaseIntentionMean', (r) => mean([r.pin1, r.pin2, r.pin3])],
  ['ownershipMean', (r) => mean([r.po1, r.po2, r.po3])],

  /* timing */
  ['startedAt', (r) => r.startedAt],
  ['submittedAt', (r) => r.submittedAt]
];

/* ---------------- write ----------------
 *
 * The custom text is free-form participant input, so it can contain commas, quotes and
 * newlines. Quoting everything and doubling internal quotes is the RFC 4180 way and is
 * what stops one participant's comma shifting every later column on that row. */

function cell(value) {
  if (value === null || value === undefined) return '';
  const s = value instanceof Date ? value.toISOString() : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

const lines = [COLUMNS.map(([name]) => cell(name)).join(',')];
for (const r of responses) {
  lines.push(COLUMNS.map(([, get]) => cell(get(r))).join(','));
}

await mkdir(path.dirname(outPath), { recursive: true });
/* BOM so Excel opens it as UTF-8 rather than mangling any non-ASCII custom text. */
await writeFile(outPath, '\ufeff' + lines.join('\r\n') + '\r\n', 'utf8');

/* ---------------- report ---------------- */

console.log(`\n  Wrote ${outPath}`);
console.log(`    ${responses.length} completed responses, ${COLUMNS.length} columns\n`);

const byCell = new Map();
for (const r of responses) {
  const key = `${r.generation} / ${r.assignedCondition} / Level ${r.assignedLevel}`;
  byCell.set(key, (byCell.get(key) || 0) + 1);
}

if (byCell.size) {
  console.log('  Responses per cell:');
  for (const key of [...byCell.keys()].sort()) {
    console.log(`    ${key.padEnd(34)} ${byCell.get(key)}`);
  }
}

const incomplete = responses.filter((r) => r.completed !== true).length;
if (incomplete) {
  console.log(`\n  Warning: ${incomplete} row(s) are not marked completed. The export`);
  console.log('  endpoint should never return those -- worth investigating.');
}

/* Sessions seeded by the cell preview are filtered out by listCompleted, so finding one
   here means that filter is not doing its job and the dataset has demonstration runs
   mixed into it. Loud, because it is indistinguishable from real data once exported. */
const previews = responses.filter((r) => r.isPreview === true).length;
if (previews) {
  console.log(`\n  WARNING: ${previews} row(s) are preview sessions, not participants.`);
  console.log('  These must not be in an export. Exclude them before analysing and');
  console.log('  check listCompleted in src/stores.js.');
}

const fast = responses.filter((r) => r.flaggedFast === true).length;
if (fast) {
  console.log(`\n  ${fast} response(s) flagged as fast (Stage 4 under the threshold).`);
  console.log('  Kept deliberately: decide whether to exclude them at analysis time.');
}
console.log('');
