/* One-time asset extraction from the prototype HTML.
 *
 * The prototype inlines twelve garment photographs and their skin/shirt masks as
 * base64 data URIs in a single 9.2MB file, and its boot sequence decodes and
 * precomputes a shading field for all twelve before the first paint. That is a slow
 * load and a plausible out-of-memory failure on a mid-range phone, and a participant
 * only ever reaches the combinations their assigned level and model allow: one
 * garment at Level 1, six at Levels 2 and 3.
 *
 * Splitting the payload into real files lets the browser cache each one, lets the
 * renderer fetch only what it needs, and keeps the prototype itself out of the
 * deployed bundle -- which also matters for blinding, since the single file contains
 * every control.
 *
 * Usage: node tools/extract-assets.mjs [path-to-prototype.html]
 */

import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');

const DEFAULT_PROTOTYPE = path.join(projectRoot, 'prototype', 'tshirt-tone-v9.html');
const OUT_DIR = path.join(projectRoot, 'public', 'assets', 'combos');

/* The manifest key is spelled out rather than derived from the field name, so that the
 * names the renderer reads are visible here next to the files they point at. */
const FIELDS = {
  imgSrc: { file: 'photo.png', key: 'photo' },
  skinMaskSrc: { file: 'skin-mask.png', key: 'skinMask' },
  shirtMaskSrc: { file: 'shirt-mask.png', key: 'shirtMask' }
};

function fail(message) {
  console.error(`\n  extract-assets: ${message}\n`);
  process.exit(1);
}

/* PNG dimensions live in the IHDR chunk, which is always first: an 8-byte signature,
 * a 4-byte length, the 4-byte chunk type, then width and height as big-endian uint32.
 * Reading them here means the renderer can size its canvas before any image decodes. */
function pngSize(buffer) {
  if (buffer.length < 24) return null;
  const isPng = buffer[0] === 0x89 && buffer.toString('ascii', 1, 4) === 'PNG';
  if (!isPng || buffer.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function decodeDataUri(uri, label) {
  const comma = uri.indexOf(',');
  if (comma < 0 || !/^data:image\/png;base64$/i.test(uri.slice(0, comma))) {
    fail(`${label} is not a base64 PNG data URI`);
  }
  return Buffer.from(uri.slice(comma + 1), 'base64');
}

/* The combos are located by key position rather than by matching braces, so the parse
 * does not depend on the four fields staying in their current order. */
function parseCombos(html) {
  const start = html.indexOf('const COMBOS');
  if (start < 0) fail('could not find `const COMBOS` in the prototype');

  const region = html.slice(start);
  const keyPattern = /"([a-z]+_[a-z]+_[a-z]+)"\s*:\s*\{/g;

  const found = [];
  let match;
  while ((match = keyPattern.exec(region)) !== null) {
    found.push({ key: match[1], from: match.index + match[0].length });
  }
  if (!found.length) fail('found `const COMBOS` but no combo entries inside it');

  return found.map((entry, i) => {
    const block = region.slice(entry.from, i + 1 < found.length ? found[i + 1].index : undefined);
    const field = (name) => {
      const m = new RegExp(`"${name}"\\s*:\\s*"([^"]+)"`).exec(block);
      if (!m) fail(`combo "${entry.key}" has no ${name}`);
      return m[1];
    };
    return {
      key: entry.key,
      imgSrc: field('imgSrc'),
      skinMaskSrc: field('skinMaskSrc'),
      shirtMaskSrc: field('shirtMaskSrc'),
      originalHex: field('originalHex')
    };
  });
}

const mb = (bytes) => (bytes / 1024 / 1024).toFixed(2);

async function main() {
  const source = path.resolve(process.argv[2] || DEFAULT_PROTOTYPE);
  if (!existsSync(source)) {
    fail(
      `prototype not found at\n    ${source}\n\n  ` +
        'Place tshirt-tone-v9.html in prototype/ or pass its path as an argument.'
    );
  }

  console.log(`\n  Reading ${path.relative(projectRoot, source)} ...`);
  const html = await readFile(source, 'utf8');
  console.log(`  ${mb(Buffer.byteLength(html))} MB of HTML`);

  const combos = parseCombos(html);
  console.log(`  Found ${combos.length} combos: ${combos.map((c) => c.key).join(', ')}\n`);

  await rm(OUT_DIR, { recursive: true, force: true });
  await mkdir(OUT_DIR, { recursive: true });

  const manifest = { combos: {}, models: [], necklines: [], sleeves: [] };
  let total = 0;

  for (const combo of combos) {
    const dir = path.join(OUT_DIR, combo.key);
    await mkdir(dir, { recursive: true });

    const entry = { originalHex: combo.originalHex };
    let comboBytes = 0;

    for (const [field, { file, key }] of Object.entries(FIELDS)) {
      const buffer = decodeDataUri(combo[field], `${combo.key}.${field}`);
      await writeFile(path.join(dir, file), buffer);

      entry[key] = `assets/combos/${combo.key}/${file}`;

      const size = pngSize(buffer);
      if (field === 'imgSrc') {
        if (!size) fail(`${combo.key}.imgSrc is not a readable PNG`);
        entry.width = size.width;
        entry.height = size.height;
      }
      comboBytes += buffer.length;
    }

    const [model, neckline, sleeve] = combo.key.split('_');
    entry.model = model;
    entry.neckline = neckline;
    entry.sleeve = sleeve;
    if (!manifest.models.includes(model)) manifest.models.push(model);
    if (!manifest.necklines.includes(neckline)) manifest.necklines.push(neckline);
    if (!manifest.sleeves.includes(sleeve)) manifest.sleeves.push(sleeve);

    manifest.combos[combo.key] = entry;
    total += comboBytes;
    console.log(
      `  ${combo.key.padEnd(26)} ${entry.width}x${entry.height}  ${mb(comboBytes).padStart(6)} MB`
    );
  }

  await writeFile(path.join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2));

  const perCombo = total / combos.length;
  console.log(`\n  Wrote ${combos.length} combos, ${mb(total)} MB total.`);
  console.log(`  A Level 1 participant now downloads ~${mb(perCombo)} MB instead of ${mb(total)} MB.`);
  console.log(`  Manifest: public/assets/combos/manifest.json\n`);
}

main().catch((err) => fail(err.stack || err.message));
