/* Self-check for the parts of this build where a silent mistake would ruin the data.
 *
 * Two halves. The unit half imports the design and randomisation modules directly and
 * checks the cell map against the brief's table, the allocation caps, the uniformity of
 * the draw and the engagement arithmetic. The integration half walks the participant
 * journey over HTTP against a running dev server and checks resume, duplicate control,
 * eligibility and -- most importantly -- that nothing in a participant-facing response
 * names their condition or level.
 *
 * Usage:
 *   node tools/self-check.mjs                 unit checks only
 *   node tools/self-check.mjs http://127.0.0.1:8787   unit + integration
 *
 * Against a remote host, set ADMIN_TOKEN in the environment for the admin checks, and
 * note that the two destructive ones are skipped unless --destructive-ok is passed. The
 * integration half writes real sessions, so point it at a deployment before recruiting,
 * not during collection.
 */

import {
  CONDITIONS,
  CONTROLS_BY_LEVEL,
  CUSTOMISATION_CHANGES_BY_LEVEL,
  ENGAGEMENT_FLAGS_BY_LEVEL,
  LEVELS,
  TARGET_PER_CELL,
  allCells,
  cellIdFor,
  generationForBirthYear,
  modelForGender,
  revealSentence
} from '../src/study-design.js';
import { assignCell, openCellsFor } from '../src/randomise.js';
import { computeEngagement, customisationForLevel } from '../src/engagement.js';
import { buildControlBundle } from '../src/stage4-controls.js';
import { createRouter } from '../src/router.js';
import { StudyService } from '../src/study-service.js';
import { KvStore, MemoryKv } from '../src/stores.js';
import { COLOUR_POOL } from '../public/shared/study-config.js';
import { readFile, readdir } from 'node:fs/promises';

let passed = 0;
const failures = [];

function check(name, condition, detail) {
  if (condition) { passed++; return; }
  failures.push(detail ? `${name}\n      ${detail}` : name);
}

function section(title) {
  console.log(`\n  ${title}`);
}

/* ---------------- colour pool ---------------- */

section('Colour pool');

check('pool has exactly 10 hues', COLOUR_POOL.length === 10, `got ${COLOUR_POOL.length}`);
check(
  'all hues share one saturation and lightness',
  new Set(COLOUR_POOL.map((c) => `${c.s}|${c.l}`)).size === 1,
  'a swatch differing in S or L would confound hue preference with brightness'
);
check('every hue has a distinct hex', new Set(COLOUR_POOL.map((c) => c.hex)).size === 10);
check('every hue has a plain name for the reveal', COLOUR_POOL.every((c) => c.name && !/[A-Z]/.test(c.name)));
check(
  'no near-white or unsaturated swatch in the pool',
  COLOUR_POOL.every((c) => c.s > 0.3),
  'the prototype "White" and "Original" swatches must be excluded'
);

/* ---------------- cell map ---------------- */

section('Twelve-cell structure');

const cells = allCells();
check('12 cells exist', cells.length === 12, `got ${cells.length}`);
check('cell ids are 1..12 with no gaps', cells.map((c) => c.cellId).join(',') === '1,2,3,4,5,6,7,8,9,10,11,12');

/* The brief's table, transcribed independently of the implementation so that a change
   to the arithmetic cannot quietly agree with itself. */
const EXPECTED = {
  'GenX|Liked|1': 1, 'GenX|Liked|2': 2, 'GenX|Liked|3': 3,
  'GenX|Disliked|1': 4, 'GenX|Disliked|2': 5, 'GenX|Disliked|3': 6,
  'GenZ|Liked|1': 7, 'GenZ|Liked|2': 8, 'GenZ|Liked|3': 9,
  'GenZ|Disliked|1': 10, 'GenZ|Disliked|2': 11, 'GenZ|Disliked|3': 12
};
for (const [key, expected] of Object.entries(EXPECTED)) {
  const [g, c, l] = key.split('|');
  check(`cell ${key} is ${expected}`, cellIdFor(g, c, Number(l)) === expected, `got ${cellIdFor(g, c, Number(l))}`);
}
check('an unknown generation yields no cell', cellIdFor('GenY', 'Liked', 1) === null);
check('an out-of-range level yields no cell', cellIdFor('GenX', 'Liked', 4) === null);

/* ---------------- generation from birth year ---------------- */

section('Eligibility and generation');

check('1965 is Gen X', generationForBirthYear(1965) === 'GenX');
check('1980 is Gen X', generationForBirthYear(1980) === 'GenX');
check('1997 is Gen Z', generationForBirthYear(1997) === 'GenZ');
check('2008 is Gen Z', generationForBirthYear(2008) === 'GenZ');
check('1964 is ineligible', generationForBirthYear(1964) === null);
check('1981 is ineligible', generationForBirthYear(1981) === null);
check('1996 is ineligible (the gap between the two windows)', generationForBirthYear(1996) === null);
check('2009 is ineligible', generationForBirthYear(2009) === null);
check('a non-integer year is ineligible', generationForBirthYear('nineteen seventy') === null);

/* ---------------- model derivation ---------------- */

section('Model derivation');

check('Male maps to the male model', modelForGender('Male') === 'male');
check('Female maps to the female model', modelForGender('Female') === 'female');
check(
  'declining to state a gender still yields a model',
  modelForGender('Prefer not to say') === 'female',
  'declining must carry no visible consequence'
);

/* ---------------- allocation ---------------- */

section('Cell-count-aware allocation');

check('a fresh study opens all 6 cells for a generation', openCellsFor('GenX', {}).length === 6);

const oneFull = { 1: TARGET_PER_CELL };
check(
  'a cell at target is withdrawn from the draw',
  openCellsFor('GenX', oneFull).length === 5 && !openCellsFor('GenX', oneFull).some((c) => c.cellId === 1)
);
check(
  'a cell one short of target stays open',
  openCellsFor('GenX', { 1: TARGET_PER_CELL - 1 }).length === 6
);
check(
  'over-target counts do not reopen a cell',
  !openCellsFor('GenX', { 1: TARGET_PER_CELL + 5 }).some((c) => c.cellId === 1)
);
check(
  'Gen X counts never affect Gen Z availability',
  openCellsFor('GenZ', { 1: 99, 2: 99, 3: 99, 4: 99, 5: 99, 6: 99 }).length === 6
);

const allGenXFull = { 1: 20, 2: 20, 3: 20, 4: 20, 5: 20, 6: 20 };
check('assignment returns null when every cell is full', assignCell('GenX', allGenXFull) === null);
check(
  'a full Gen X does not block Gen Z',
  assignCell('GenZ', allGenXFull) !== null
);

/* Only the open cell can be drawn. Repeated so a lucky single draw cannot pass. */
const onlyCell6Open = { 1: 20, 2: 20, 3: 20, 4: 20, 5: 20 };
let escaped = 0;
for (let i = 0; i < 400; i++) {
  if (assignCell('GenX', onlyCell6Open).cellId !== 6) escaped++;
}
check('the draw never lands on a full cell', escaped === 0, `${escaped} of 400 draws escaped`);

/* Uniformity. With 6 open cells and 12000 draws each cell expects 2000; a correct
   uniform draw stays well inside 15%, and a biased or Math.random-modulo draw would
   not. This guards the allocation integrity the whole study rests on. */
const tally = {};
const DRAWS = 12000;
for (let i = 0; i < DRAWS; i++) {
  const cell = assignCell('GenX', {});
  tally[cell.cellId] = (tally[cell.cellId] || 0) + 1;
}
const expectedShare = DRAWS / 6;
const worst = Math.max(...Object.values(tally).map((n) => Math.abs(n - expectedShare) / expectedShare));
check(
  'the draw is uniform across open cells',
  Object.keys(tally).length === 6 && worst < 0.15,
  `worst deviation ${(worst * 100).toFixed(1)}% across ${JSON.stringify(tally)}`
);

/* Both conditions and all three levels must actually occur. */
check(
  'both conditions are reachable',
  new Set(Object.keys(tally).map((id) => cells.find((c) => c.cellId === Number(id)).condition)).size === CONDITIONS.length
);
check(
  'all three levels are reachable',
  new Set(Object.keys(tally).map((id) => cells.find((c) => c.cellId === Number(id)).level)).size === LEVELS.length
);

/* ---------------- controls per level ---------------- */

section('Controls and blinding boundaries');

check('Level 1 is offered no controls', CONTROLS_BY_LEVEL[1].length === 0);
check(
  'Level 2 has text, sleeve and neck but no skin tone',
  CONTROLS_BY_LEVEL[2].length === 3 && !CONTROLS_BY_LEVEL[2].includes('skinTone'),
  JSON.stringify(CONTROLS_BY_LEVEL[2])
);
check(
  'Level 3 is Level 2 plus skin tone',
  CONTROLS_BY_LEVEL[3].includes('skinTone') &&
    CONTROLS_BY_LEVEL[2].every((c) => CONTROLS_BY_LEVEL[3].includes(c)),
  JSON.stringify(CONTROLS_BY_LEVEL[3])
);

/* The list shown before "Start customising" has to track the controls actually served,
   or a participant is promised something they do not get, or not told about something
   they do. It is also the one participant-facing text that differs by level, so it is
   the obvious place for the design to leak. */

check(
  'Level 1 is promised no changes',
  CUSTOMISATION_CHANGES_BY_LEVEL[1].length === 0
);
check(
  'the promised changes match the controls served at each level',
  [2, 3].every((l) => CUSTOMISATION_CHANGES_BY_LEVEL[l].length === CONTROLS_BY_LEVEL[l].length),
  `level 2: ${CUSTOMISATION_CHANGES_BY_LEVEL[2].length} promised for ` +
    `${CONTROLS_BY_LEVEL[2].length} controls; level 3: ` +
    `${CUSTOMISATION_CHANGES_BY_LEVEL[3].length} for ${CONTROLS_BY_LEVEL[3].length}`
);
check(
  'the Level 2 list never mentions skin or tone',
  !/skin|tone|colour of the model/i.test(CUSTOMISATION_CHANGES_BY_LEVEL[2].join(' ')),
  `this is the blinding boundary: ${JSON.stringify(CUSTOMISATION_CHANGES_BY_LEVEL[2])}`
);
check(
  'the Level 3 list names the skin-tone control',
  /skin tone/i.test(CUSTOMISATION_CHANGES_BY_LEVEL[3].join(' ')),
  JSON.stringify(CUSTOMISATION_CHANGES_BY_LEVEL[3])
);
/* Pinned rather than pattern-matched. This one string decides whether the skin-tone
   measure reads as a preference revealed or as an instruction followed, so it is not
   copy that should be reworded in passing: a failure here means someone changed the
   construct, and the write-up has to change with it. */
check(
  'the Level 3 skin-tone wording is exactly the agreed instruction',
  CUSTOMISATION_CHANGES_BY_LEVEL[3].at(-1) === "Change the model's skin tone to match yours",
  `found ${JSON.stringify(CUSTOMISATION_CHANGES_BY_LEVEL[3].at(-1))}; ` +
    'the study is written up as matching under instruction'
);

/* ---------------- reveal wording ---------------- */

section('Reveal wording');

const likedSentence = revealSentence('teal', 'Liked');
const dislikedSentence = revealSentence('teal', 'Disliked');

check('the liked reveal names the colour', likedSentence.includes('teal'));
check('the two reveals differ only in the final clause',
  likedSentence.replace('like the most', 'X') === dislikedSentence.replace('like the least', 'X'),
  `\n      liked:    ${likedSentence}\n      disliked: ${dislikedSentence}`
);
check(
  'neither reveal is emotionally loaded',
  ![likedSentence, dislikedSentence].some((s) => /[!]|sorry|unfortunately|great|love|congratul/i.test(s))
);
check(
  'the two reveals are close in length',
  Math.abs(likedSentence.length - dislikedSentence.length) <= 2,
  'matched length keeps tone comparable across conditions'
);
check('an unnamed colour still yields a sentence', revealSentence(null, 'Liked').includes('this colour'));
check(
  'no em dash survives in either reveal',
  ![likedSentence, dislikedSentence].some((s) => s.includes('\u2014')),
  'the attribution is parenthesised on its own line instead'
);
check(
  'the attribution sits on a second line, in brackets',
  [likedSentence, dislikedSentence].every((s) => {
    const lines = s.split('\n');
    return lines.length === 2 &&
      lines[0].endsWith('.') &&
      /^\(The colour you told us you like the (most|least)\)$/.test(lines[1]);
  }),
  `\n      ${JSON.stringify(likedSentence)}`
);

/* ---------------- engagement ---------------- */

section('Engagement index');

const untouched = { text: '', sleeveLength: 'short', neckType: 'round', skinToneMoved: false };

check('Level 1 always scores zero', computeEngagement(1, untouched).engagementIndex === 0);
check(
  'Level 1 carries no individual flags',
  Object.keys(computeEngagement(1, untouched)).length === 1,
  'a level with no controls should not store flags implying it had some'
);
check('an untouched Level 2 scores zero', computeEngagement(2, untouched).engagementIndex === 0);
check('an untouched Level 3 scores zero', computeEngagement(3, untouched).engagementIndex === 0);

check(
  'entering text counts once',
  computeEngagement(2, { ...untouched, text: 'hello' }).engagementIndex === 1
);
check(
  'whitespace-only text does not count as engagement',
  computeEngagement(2, { ...untouched, text: '   ' }).engagementIndex === 0
);
check(
  'changing sleeve counts',
  computeEngagement(2, { ...untouched, sleeveLength: 'long' }).engagementIndex === 1
);
check(
  'changing neck counts',
  computeEngagement(2, { ...untouched, neckType: 'v' }).engagementIndex === 1
);
check(
  'Level 2 maxes out at 3',
  computeEngagement(2, { text: 'hi', sleeveLength: 'long', neckType: 'v', skinToneMoved: true })
    .engagementIndex === 3,
  'skin tone must not count at a level that never had the control'
);
check(
  'Level 3 maxes out at 4',
  computeEngagement(3, { text: 'hi', sleeveLength: 'long', neckType: 'v', skinToneMoved: true })
    .engagementIndex === 4
);
check(
  'moving the tone slider counts only at Level 3',
  computeEngagement(3, { ...untouched, skinToneMoved: true }).engagementIndex === 1 &&
    computeEngagement(2, { ...untouched, skinToneMoved: true }).engagementIndex === 0
);
check(
  'the index equals the number of true flags',
  ENGAGEMENT_FLAGS_BY_LEVEL[3].every((f) => f in computeEngagement(3, untouched))
);

section('Stored customisation shape');

check('Level 1 stores no customisation values', Object.keys(customisationForLevel(1, untouched)).length === 0);
check(
  'Level 2 stores no skin tone',
  !('skinTone' in customisationForLevel(2, { ...untouched, skinTone: 0.7 })),
  'storing a value for a control that was never shown would misrepresent the record'
);
check('Level 3 stores skin tone', 'skinTone' in customisationForLevel(3, { ...untouched, skinTone: 0.7 }));

/* ---------------- generated bundles must be valid JavaScript ----------------
 *
 * The controls are serialised with Function.prototype.toString() and executed in the
 * browser via the Function constructor, so a control that accidentally closes over a
 * module-scope name would parse here and fail only in front of a participant. Parsing
 * each bundle and checking its free variables catches that at build time. */

section('Control bundle integrity');

for (const level of [1, 2, 3]) {
  const bundle = buildControlBundle(CONTROLS_BY_LEVEL[level]);
  let parsed = true;
  try {
    // eslint-disable-next-line no-new-func
    new Function('ctx', bundle);
  } catch (err) {
    parsed = false;
    failures.push(`level ${level} bundle does not parse: ${err.message}`);
  }
  check(`the level ${level} bundle parses`, parsed);
  check(
    `the level ${level} bundle returns a collect function`,
    bundle.includes('return { collect:')
  );
}

const level1Bundle = buildControlBundle(CONTROLS_BY_LEVEL[1]);
const level2Bundle = buildControlBundle(CONTROLS_BY_LEVEL[2]);
const level3Bundle = buildControlBundle(CONTROLS_BY_LEVEL[3]);

check(
  'the level 1 bundle mentions no control at all',
  !/Custom text|Sleeve length|Neckline|Model tone/.test(level1Bundle)
);
check(
  'the level 2 bundle contains no skin-tone control',
  !/Model tone|toneTrackGradient|toneLabelFor/.test(level2Bundle),
  'this is the blinding boundary: a Level 2 bundle must not hint the control exists'
);
check('the level 2 bundle contains the other three controls',
  /Custom text/.test(level2Bundle) && /Sleeve length/.test(level2Bundle) && /Neckline/.test(level2Bundle)
);
check('the level 3 bundle contains the skin-tone control', /Model tone/.test(level3Bundle));
check(
  'the level 3 bundle is a superset of level 2',
  /Custom text/.test(level3Bundle) && /Sleeve length/.test(level3Bundle) && /Neckline/.test(level3Bundle)
);

/* ---------------- the deploy bundler's helpers must not break the controls ----------
 *
 * The controls reach the browser as text produced by Function.prototype.toString(), so
 * whatever the Worker's bundler did to the source travels with them. esbuild appends
 * `__name(fn, "fn")` after each function declaration, which is not defined in the
 * browser and throws at the first inner function a control declares. Nothing catches
 * this locally, because the dev server imports the modules and never runs esbuild:
 * every level worked on 127.0.0.1 and every level was broken once deployed. */

check(
  'the prelude shims the bundler helper the deployed controls carry',
  /var __name = /.test(level1Bundle),
  'without it, every control throws at its first inner function once deployed'
);

let shimHolds = true;
let shimError = '';
try {
  const withHelper = level1Bundle.replace(
    'return { collect:',
    '__name(function probe() {}, "probe");\nreturn { collect:'
  );
  // eslint-disable-next-line no-new-func
  new Function('ctx', withHelper)({});
} catch (err) {
  shimHolds = false;
  shimError = err.message;
}
check(
  'a bundle carrying an esbuild __name call still executes',
  shimHolds,
  shimError
);

/* ---------------- the renderer must be importable ----------------
 *
 * Top-level code in the renderer builds its gamma lookup tables and must touch no DOM,
 * or it would fail before a canvas ever exists. Importing it under Node, where there is
 * no document at all, is the cheapest way to prove that. */

section('Renderer module');

try {
  const renderer = await import('../public/renderer/tshirt-renderer.js');
  check('the renderer imports with no DOM present', typeof renderer.createRenderer === 'function');
  check('it exposes the font bounds the text control needs',
    typeof renderer.FONT_MIN === 'number' && typeof renderer.FONT_MAX === 'number');
  check('it exposes the tone helpers the skin-tone control needs',
    typeof renderer.toneTrackGradient === 'function' && typeof renderer.toneLabelFor === 'function');
  check('the tone gradient is a usable css value', renderer.toneTrackGradient().startsWith('linear-gradient('));
  check('tone labels span the slider', renderer.toneLabelFor(0) === 'Lightest' && renderer.toneLabelFor(1) === 'Darkest');
} catch (err) {
  failures.push(`the renderer could not be imported: ${err.message}`);
}

/* ---------------- the two pauses at the head of Stage 4 must stay matched ----------------
 *
 * stage4CompletionSeconds is compared across levels, so the invitation to linger has to
 * be the same invitation for participants with controls and for those without. Losing
 * one of these lines, rewording only one of them, or placing them differently would turn
 * part of a timing difference into an artefact of the copy. */

section('Stage 4 instruction');

const hostSource = await readFile(new URL('../public/stage4/host.js', import.meta.url), 'utf8');

check(
  'the no-controls view invites a pause and names the button',
  /const LOOK_HINT = 'Take a moment to look at this T-shirt, then click Continue\.';/.test(hostSource)
);
check(
  'the controls view invites a pause and names the button',
  /const CUSTOMISE_HINT = 'Take a moment to customise and then click Continue when you are ready\.';/.test(
    hostSource
  )
);
check(
  'both hints are actually rendered, not merely declared',
  /text: LOOK_HINT/.test(hostSource) && /text: CUSTOMISE_HINT/.test(hostSource),
  'a declared but unused hint is a line no participant ever sees'
);
/* Both lines name the button, so renaming the button silently makes both of them point
   at something the participant cannot find. */
check(
  'the button both hints name is still labelled Continue',
  /h\('button', \{ class: 'cta', text: 'Continue' \}\)/.test(hostSource),
  'rename the button and the instructions have to be reworded with it'
);

/* Placement, not just presence. Both must head the garment rather than trail the page,
   and the controls view must not raise its line before there is a Continue button for
   it to name. */
check(
  'the no-controls view puts its instruction above the garment',
  /text: LOOK_HINT \}\),\s*\n\s*frame,/.test(hostSource),
  'the instruction must precede the frame, not follow it'
);
check(
  'the controls view puts its instruction above the garment',
  /photoCol\.prepend\(h\('p', \{ class: 'stage4-instruction', text: CUSTOMISE_HINT \}\)\);/.test(
    hostSource
  ),
  'it belongs at the head of the sticky photo column'
);
check(
  'the controls view raises its instruction only once the controls exist',
  hostSource.indexOf('photoCol.prepend') > hostSource.indexOf('async function startCustomising'),
  'shown any earlier it would name a Continue button that is not on screen yet'
);

/* Salience is part of the nudge, not decoration. If one of the two lines were styled as
   a heading and the other as small print, the levels would differ in how firmly they
   were told to pause, which lands in stage4CompletionSeconds. */
check(
  'both hints are styled at the same weight',
  (hostSource.match(/class: 'stage4-instruction', text: (LOOK|CUSTOMISE)_HINT/g) || []).length === 2,
  'one hint is styled differently from the other'
);

const cssSource = await readFile(new URL('../public/styles.css', import.meta.url), 'utf8');

check(
  'the instruction takes its type from the control labels',
  /\.control-label,\s*\n\.stage4-instruction \{/.test(cssSource),
  'they must share one declaration, or restyling the labels leaves the instruction behind'
);
check(
  'the instruction is separated from the garment below it',
  /\.stage4-instruction \{ margin: 0 0 \d+px; /.test(cssSource),
  'the gap belongs underneath now that the line sits above the photograph'
);

/* ---------------- the stacked layout must not inherit a height ---------------- */

section('Stage 4 layout');

/* Read once and asserted against, so these checks cannot accidentally be satisfied by
   the desktop rules of the same name that sit outside the breakpoint. */
const stackedBlock = (cssSource.match(/@media \(max-width: 760px\) \{[\s\S]*?\n\}/) || [''])[0];

check('the stacked-layout rules were found', stackedBlock.length > 0);

check(
  'the columns are still sized side by side above the breakpoint',
  /\.photo-col \{ flex: 1 1 420px;/.test(cssSource) && /\.info-col \{ flex: 1 1 340px;/.test(cssSource),
  'the desktop basis is what gives the photograph its share of the row'
);

/* Two separate faults come out of the same declaration, so they get a check each. The
   basis is a width while the columns sit side by side and a height the moment the
   breakpoint turns the row into a column: left alone it holds the garment column open to
   420px and drops a band of empty space between the photograph and the first control. */
check(
  'the stacked layout resets the flex basis on both columns',
  /flex: 0 0 auto;/.test(stackedBlock),
  'the basis becomes a minimum height and reopens the gap under the garment'
);

/* The garment has to stay visible while the controls are used. Stacked, the controls sit
   below it, so a static photograph leaves at the top of the scroll just as the
   participant reaches the thing that changes it -- and a stage about seeing the effect of
   your own choices becomes one about remembering it. */
check(
  'the garment stays pinned once the columns stack',
  /position: sticky;/.test(stackedBlock) && /top: 0;/.test(stackedBlock),
  'static here puts the photograph off screen exactly when the controls come into reach'
);
check(
  'the pinned garment is opaque and sits above the controls',
  /background: var\(--panel\);/.test(stackedBlock) && /z-index: 2;/.test(stackedBlock),
  'the controls pass underneath it, so it cannot be transparent or beneath them'
);
check(
  'the pinned garment is capped in height',
  /\.photo-col \.frame \{ max-width: \d+vh;/.test(stackedBlock),
  'uncapped it fills the screen and leaves no room to work in'
);

check(
  'the pinned garment is separated by a flat border, not a shadow',
  /border-bottom: 1px solid var\(--line\);/.test(stackedBlock) &&
    !/box-shadow/.test(stackedBlock),
  'a shadow makes it a panel floating over the card rather than part of it'
);

/* The fault this guards against overhangs the card by 38px at 360px wide and not at all
   at 412px, so it presents as a bug on particular handsets and is invisible on every
   desktop. The minimum widths it comes from are load-bearing for the side-by-side row,
   which is why they are reset here rather than removed. */
check(
  'the stacked columns drop the minimum widths meant for the row',
  /\.photo-col,\s*\n\s*\.info-col \{ flex: 0 0 auto; width: 100%; min-width: 0; \}/.test(
    stackedBlock
  ),
  'a 300px floor inside a 262px card pushes the garment past the card edge'
);

/* Every option row has to end at the same right edge. A flex item defaults to
   min-width: auto, so a row whose longest label is one unbreakable word stops shrinking
   before the others do and juts out past them. It shows up on the three-option rows
   first, because a third of a phone-width column is the narrowest any pill gets. */
/* Matched without reference to line endings: the stylesheet is CRLF here and would be
   LF on a checkout elsewhere, and a check that quietly depends on which is a check that
   fails for the wrong reason. */
check(
  'option pills may shrink below their longest word',
  /\.pill-option \{[^}]*?min-width: 0;/.test(cssSource),
  'without min-width: 0 the sleeve row is wider than the neckline and colour rows'
);
check(
  'the pills are given tighter padding once stacked',
  /@media \(max-width: 760px\) \{[\s\S]*?\.pill-option \{ padding: 10px \dpx; \}/.test(cssSource),
  'at a third of a phone-width column the padding decides whether the label wraps'
);

/* ---------------- the development preview must not exist in production ----------------
 *
 * The preview route opens any cell on demand, which is precisely what a participant must
 * never be able to do. It is gated by the host passing `preview: true` rather than by an
 * environment variable, so the assertions that matter are that the route is absent from
 * the default table, that the Worker entry point never switches it on, and that no trace
 * of it reaches public/. The router is exercised in-process here, with the real service
 * over an in-memory store, so this half needs no server. */

section('Development preview is dev-only');

function routerFor(options) {
  return createRouter({
    service: new StudyService(new KvStore(new MemoryKv(), 'self-check')),
    env: { EMAIL_HASH_SALT: 'self-check-salt', ADMIN_TOKEN: 'self-check-token' },
    serveAsset: async () => new Response('asset'),
    ...options
  });
}

const previewBody = (condition, level) => JSON.stringify({
  generation: 'GenZ', condition, level, gender: 'Male'
});

function previewRequest(condition, level) {
  return new Request('http://localhost/api/dev/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: previewBody(condition, level)
  });
}

const closedRouter = routerFor({});
const closed = await closedRouter(previewRequest('Liked', 3));
check(
  'the preview route is absent unless the host enables it',
  closed.status === 404,
  `got ${closed.status}; the deployed Worker must have no such path at all`
);

const openRouter = routerFor({ preview: true });

/* Forcing a level must actually decide the bundle, or the preview would show the wrong
   controls and quietly certify a level that was never really tested. */
for (const [level, mustContain, mustNotContain] of [
  [1, null, /Custom text|Sleeve length|Neckline|Model tone/],
  [2, /Custom text/, /Model tone/],
  [3, /Model tone/, null]
]) {
  const seeded = await openRouter(previewRequest('Liked', level));
  const body = seeded.status === 200 ? await seeded.json() : null;
  check(`a preview session for level ${level} is seeded`, seeded.status === 200 && !!body?.sessionId,
    `status ${seeded.status}`);
  if (!body?.sessionId) continue;

  check(
    `the level ${level} preview reports customisation correctly`,
    body.assignment?.customisation?.enabled === (level !== 1)
  );

  const bundleRes = await openRouter(new Request('http://localhost/api/stage4/controls', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Session-Id': body.sessionId },
    body: '{}'
  }));
  const bundle = await bundleRes.text();
  check(`the forced level ${level} decides which bundle is served`,
    (!mustContain || mustContain.test(bundle)) && (!mustNotContain || !mustNotContain.test(bundle)));
}

const badCell = await openRouter(previewRequest('Nonsense', 9));
check('the preview refuses a condition or level that is not in the design', badCell.status === 400);

/* The gender answer decides the model photograph, so a preview that ignored it would
   have you verifying the wrong render. Asserted because the first version of the picker
   sent a value that was not in the option list and silently got the default. */
const maleSeed = await openRouter(previewRequest('Liked', 2));
const maleBody = maleSeed.status === 200 ? await maleSeed.json() : null;
check(
  'the preview derives the model from the gender answer',
  maleBody?.assignment?.model === 'male',
  `got ${maleBody?.assignment?.model}`
);

const looseGender = await openRouter(new Request('http://localhost/api/dev/preview', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ generation: 'GenZ', condition: 'Liked', level: 1, gender: 'female' })
}));
check('the preview refuses a gender that is not one of the offered options', looseGender.status === 400);

const workerEntry = await readFile(new URL('../src/index.js', import.meta.url), 'utf8');
check(
  'the Worker entry point never switches the preview on',
  !/preview\s*:/.test(workerEntry),
  'src/index.js must not pass preview to createRouter'
);

/* public/ is the only directory uploaded as static assets, so a preview page or fetch
   living there would be readable by any participant who opened dev tools. */
const publicFiles = await readdir(new URL('../public/', import.meta.url), { recursive: true });
const previewInPublic = [];
for (const name of publicFiles) {
  if (!/\.(js|html|css|json)$/.test(name)) continue;
  const text = await readFile(new URL(`../public/${name}`, import.meta.url), 'utf8').catch(() => '');
  if (text.includes('/api/dev/')) previewInPublic.push(name);
}
check(
  'nothing in public/ references the preview endpoint',
  previewInPublic.length === 0,
  `found in: ${previewInPublic.join(', ')}`
);

/* ---------------- integration ---------------- */

const baseUrl = process.argv[2];

/* Terms that must never appear in anything sent to a participant. Finding one means
   the browser has been handed enough to work out its own cell. */
const FORBIDDEN = ['Liked', 'Disliked', 'assignedLevel', 'assignedCondition', 'cellId', 'GenX', 'GenZ'];

async function integration(base) {
  section(`Participant journey against ${base}`);

  let uniqueEmail = 0;
  const post = async (path, body, sessionId) => {
    const headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers['X-Session-Id'] = sessionId;
    const res = await fetch(base + path, { method: 'POST', headers, body: JSON.stringify(body || {}) });
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch { /* not json */ }
    return { status: res.status, json, text };
  };

  async function walkTo(stage, birthYear = 1975) {
    const start = await post('/api/session/start');
    const sessionId = start.json.sessionId;
    if (stage === 'consent') return { sessionId };

    await post('/api/onboarding', {
      birthYear,
      gender: 'Female',
      email: `p${Date.now()}_${uniqueEmail++}@example.com`,
      ex1: 3,
      ex2: 4
    }, sessionId);
    if (stage === 'onboarding') return { sessionId };

    await post('/api/calibration', {
      likedColourHex: COLOUR_POOL[4].hex,
      dislikedColourHex: COLOUR_POOL[9].hex
    }, sessionId);
    if (stage === 'calibration') return { sessionId };

    const assign = await post('/api/assign', {}, sessionId);
    return { sessionId, assignment: assign.json };
  }

  /* Everything the browser needs must actually be served. A missing module or a
     manifest pointing at a file that is not there would leave a participant on a
     blank screen after the reveal. */
  const assetPaths = [
    '/', '/app.js', '/styles.css',
    '/shared/study-config.js', '/shared/colour.js',
    '/renderer/tshirt-renderer.js', '/stage4/host.js',
    '/assets/combos/manifest.json'
  ];
  for (const assetPath of assetPaths) {
    const res = await fetch(base + assetPath);
    check(`${assetPath} is served`, res.ok, `status ${res.status}`);
  }

  const manifest = await (await fetch(base + '/assets/combos/manifest.json')).json();
  const comboKeys = Object.keys(manifest.combos || {});
  check('the manifest lists 12 garment combos', comboKeys.length === 12, `got ${comboKeys.length}`);
  check('the manifest covers both models', (manifest.models || []).length === 2);
  check('the manifest covers three sleeve lengths', (manifest.sleeves || []).length === 3);
  check('the manifest covers two necklines', (manifest.necklines || []).length === 2);

  /* One combo is spot-checked in full: if its three images and dimensions are right,
     the extraction did its job for all of them. */
  const sample = manifest.combos[comboKeys[0]];
  check('a combo records its pixel dimensions', sample.width === 760 && sample.height === 626);
  for (const key of ['photo', 'skinMask', 'shirtMask']) {
    const res = await fetch(base + '/' + sample[key]);
    const buf = res.ok ? new Uint8Array(await res.arrayBuffer()) : new Uint8Array();
    check(
      `${comboKeys[0]}/${key} is a real png`,
      res.ok && buf[0] === 0x89 && String.fromCharCode(...buf.slice(1, 4)) === 'PNG',
      `status ${res.status}, ${buf.length} bytes`
    );
  }

  /* The deployed page must not contain the prototype, which carries every control. */
  const indexHtml = await (await fetch(base + '/')).text();
  check(
    'the entry page does not inline the prototype',
    !indexHtml.includes('data:image/png;base64') && indexHtml.length < 20000,
    `entry page is ${indexHtml.length} bytes`
  );
  const prototypeLeak = await fetch(base + '/tshirt-tone-v9.html');
  check(
    'the prototype file is not reachable from the web root',
    !prototypeLeak.ok || !(await prototypeLeak.text()).includes('SHIRT_COLOURS'),
    'the prototype contains every control and must never be served'
  );

  /* session lifecycle */
  const first = await post('/api/session/start');
  check('starting a session returns a uuid', /^[0-9a-f-]{36}$/i.test(first.json?.sessionId || ''));

  const unknown = await post('/api/session/resume', {}, '00000000-0000-4000-8000-000000000000');
  check('an unknown session id is a 404 so the client can start fresh', unknown.status === 404);

  const noSession = await post('/api/onboarding', { birthYear: 1975 });
  check('a request without a session id is rejected', noSession.status === 400);

  /* eligibility */
  const ineligible = await walkTo('consent');
  const badYear = await post('/api/onboarding', {
    birthYear: 1990, gender: 'Male', email: 'gap@example.com', ex1: 1, ex2: 1
  }, ineligible.sessionId);
  check('a birth year in the gap is refused', badYear.json?.ineligible === true, JSON.stringify(badYear.json));

  /* onboarding answers must be ones that were actually offered.
     Presence alone is not enough: a gender outside the option list used to be stored
     verbatim and then fall through to the default model, and an experience answer
     outside the scale used to be stored as given. Either would sit in the dataset
     looking like a real answer. */
  const offList = [
    ['a gender outside the offered options', { gender: 'female' }],
    ['an experience answer below the scale', { ex1: 0 }],
    ['an experience answer above the scale', { ex1: 9 }],
    ['a frequency answer outside the scale', { ex2: 42 }]
  ];
  for (const [label, override] of offList) {
    const session = await walkTo('consent');
    const res = await post('/api/onboarding', {
      birthYear: 1975,
      gender: 'Male',
      email: `offlist${Date.now()}${Math.random().toString(36).slice(2, 7)}@example.com`,
      ex1: 3,
      ex2: 3,
      ...override
    }, session.sessionId);
    check(`${label} is refused`, res.status === 400, `got ${res.status}`);
  }

  /* duplicate control */
  const dupEmail = `dup${Date.now()}@example.com`;
  const one = await walkTo('consent');
  const firstUse = await post('/api/onboarding', {
    birthYear: 1975, gender: 'Male', email: dupEmail, ex1: 1, ex2: 1
  }, one.sessionId);
  check('a first-time address is accepted', firstUse.json?.ok === true);

  const two = await walkTo('consent');
  const secondUse = await post('/api/onboarding', {
    birthYear: 1975, gender: 'Male', email: dupEmail, ex1: 1, ex2: 1
  }, two.sessionId);
  check('the same address a second time is refused', secondUse.json?.duplicate === true);

  const sameCase = await walkTo('consent');
  const casedUse = await post('/api/onboarding', {
    birthYear: 1975, gender: 'Male', email: dupEmail.toUpperCase(), ex1: 1, ex2: 1
  }, sameCase.sessionId);
  check(
    'the address is matched case-insensitively',
    casedUse.json?.duplicate === true,
    'a participant retyping their address in a different case must still be caught'
  );

  /* calibration validation */
  const cal = await walkTo('onboarding');
  const sameColour = await post('/api/calibration', {
    likedColourHex: COLOUR_POOL[0].hex, dislikedColourHex: COLOUR_POOL[0].hex
  }, cal.sessionId);
  check('the same colour cannot be both liked and disliked', sameColour.status === 400);

  const offPool = await post('/api/calibration', {
    likedColourHex: '#123456', dislikedColourHex: COLOUR_POOL[1].hex
  }, cal.sessionId);
  check('a colour outside the pool is refused', offPool.status === 400);

  /* assignment and blinding */
  const assigned = await walkTo('assigned');
  const payload = assigned.assignment;
  check('assignment returns a reveal sentence', typeof payload?.revealSentence === 'string');
  check('assignment returns a locked colour', /^#[0-9a-f]{6}$/i.test(payload?.colourHex || ''));
  check('assignment returns the hsl the renderer needs', typeof payload?.colourHsl?.h === 'number');
  check('assignment states whether customisation is available', typeof payload?.customisation?.enabled === 'boolean');

  const serialised = JSON.stringify(payload);
  const leaked = FORBIDDEN.filter((term) => serialised.includes(term));
  check(
    'the assignment response names neither condition nor level',
    leaked.length === 0,
    `leaked: ${leaked.join(', ')}`
  );
  check(
    'the assignment response carries no level number',
    !('assignedLevel' in payload) && !('level' in payload)
  );

  /* the colour must be one the participant actually chose */
  check(
    'the locked colour is one of the two the participant picked',
    [COLOUR_POOL[4].hex, COLOUR_POOL[9].hex].includes(payload.colourHex)
  );

  /* assignment must be permanent */
  const resumed = await post('/api/session/resume', {}, assigned.sessionId);
  check('resume returns the treatment stage', resumed.json?.stage === 'treatment');
  check(
    'resume returns the identical colour, never a fresh draw',
    resumed.json?.treatment?.colourHex === payload.colourHex
  );
  check(
    'resume returns the identical reveal sentence',
    resumed.json?.treatment?.revealSentence === payload.revealSentence
  );
  const reassign = await post('/api/assign', {}, assigned.sessionId);
  check(
    'calling assign again does not re-randomise',
    reassign.json?.colourHex === payload.colourHex &&
      reassign.json?.revealSentence === payload.revealSentence
  );
  const resumedLeak = FORBIDDEN.filter((t) => JSON.stringify(resumed.json).includes(t));
  check('the resume response leaks nothing either', resumedLeak.length === 0, `leaked: ${resumedLeak.join(', ')}`);

  /* control bundles must match the assigned level and nothing else */
  const bundles = { empty: 0, three: 0, four: 0 };
  const seenLevels = new Set();
  for (let i = 0; i < 24; i++) {
    const s = await walkTo('assigned');
    const res = await fetch(base + '/api/stage4/controls', {
      method: 'POST',
      headers: { 'X-Session-Id': s.sessionId }
    });
    const code = await res.text();

    const hasSkin = /toneTrackGradient|Model tone/.test(code);
    const hasText = /Custom text/.test(code);
    const hasSleeve = /Sleeve length/.test(code);
    const hasNeck = /Neckline/.test(code);
    const enabled = s.assignment.customisation.enabled;

    /* Over real HTTP, and per session: what the participant was promised has to be what
       the bundle they were served can actually do. Checked here rather than only against
       the design constants, because these are two independent paths out of the Worker and
       either one could drift. */
    const promised = (s.assignment.customisation.changes || []).join(' ');
    check(
      'the promised changes agree with the controls actually served',
      /skin tone/i.test(promised) === hasSkin &&
        /text/i.test(promised) === hasText &&
        /sleeve/i.test(promised) === hasSleeve &&
        /neck/i.test(promised) === hasNeck,
      `promised ${JSON.stringify(promised)} against a bundle with ` +
        `skin:${hasSkin} text:${hasText} sleeve:${hasSleeve} neck:${hasNeck}`
    );

    if (!enabled) {
      bundles.empty++;
      seenLevels.add(1);
      check(
        'a no-customisation session receives no controls at all',
        !hasSkin && !hasText && !hasSleeve && !hasNeck,
        'a Level 1 bundle contained a control'
      );
    } else if (hasSkin) {
      bundles.four++;
      seenLevels.add(3);
      check('a skin-tone session also has the other three controls', hasText && hasSleeve && hasNeck);
    } else {
      bundles.three++;
      seenLevels.add(2);
      check(
        'a product-level session receives no skin-tone control',
        !hasSkin && hasText && hasSleeve && hasNeck,
        'the blinding boundary leaked the skin-tone control'
      );
    }
  }
  check(
    'all three control configurations occur across 24 sessions',
    seenLevels.size === 3,
    `saw ${[...seenLevels].sort().join(', ')} in ${JSON.stringify(bundles)}`
  );

  const noSessionBundle = await fetch(base + '/api/stage4/controls', { method: 'POST' });
  check('the control endpoint refuses a request with no session', noSessionBundle.status === 400);

  const foreignBundle = await fetch(base + '/api/stage4/controls', {
    method: 'POST',
    headers: { 'X-Session-Id': '00000000-0000-4000-8000-000000000000' }
  });
  check('the control endpoint refuses an unknown session', foreignBundle.status === 404);

  const preAssignSession = await walkTo('onboarding');
  const earlyBundle = await fetch(base + '/api/stage4/controls', {
    method: 'POST',
    headers: { 'X-Session-Id': preAssignSession.sessionId }
  });
  check(
    'controls cannot be fetched before an assignment exists',
    earlyBundle.status === 404,
    'a participant must not be able to pull controls ahead of randomisation'
  );

  /* stage ordering */
  const outOfOrder = await walkTo('onboarding');
  const earlySubmit = await post('/api/submit', {
    answers: { pin1: 4, pin2: 4, pin3: 4, po1: 4, po2: 4, po3: 4, pa1: 4, cp1: 4 }
  }, outOfOrder.sessionId);
  check('the questionnaire cannot be submitted before the task', earlySubmit.status === 400);

  /* full journey with engagement */
  const full = await walkTo('assigned');
  const stage4 = await post('/api/stage4', {
    customisation: {
      text: 'my shirt',
      sleeveLength: 'long',
      neckType: 'v',
      skinTone: 0.8,
      skinToneDefault: 0.42,
      skinToneMoved: true,
      textColour: 'white',
      fontSizePx: 36,
      textPosition: { cxFrac: 0.5, cyFrac: 0.44 }
    },
    stage4CompletionSeconds: 42
  }, full.sessionId);
  check('the task saves', stage4.json?.ok === true, JSON.stringify(stage4.json));

  const badAnswer = await post('/api/submit', {
    answers: { pin1: 9, pin2: 4, pin3: 4, po1: 4, po2: 4, po3: 4, pa1: 4, cp1: 4 }
  }, full.sessionId);
  check('an out-of-range Likert answer is refused', badAnswer.status === 400);

  const missingAnswer = await post('/api/submit', { answers: { pin1: 4 } }, full.sessionId);
  check('a partially answered questionnaire is refused', missingAnswer.status === 400);

  const submitted = await post('/api/submit', {
    answers: { pin1: 7, pin2: 6, pin3: 5, po1: 4, po2: 3, po3: 2, pa1: 1, cp1: 7 }
  }, full.sessionId);
  check('the questionnaire submits', submitted.json?.ok === true);

  const afterDone = await post('/api/session/resume', {}, full.sessionId);
  check('a submitted session reports as done', afterDone.json?.stage === 'done');

  /* fast completion flagging */
  const rushed = await walkTo('assigned');
  await post('/api/stage4', {
    customisation: { text: '', sleeveLength: 'short', neckType: 'round' },
    stage4CompletionSeconds: 3
  }, rushed.sessionId);
  await post('/api/submit', {
    answers: { pin1: 1, pin2: 1, pin3: 1, po1: 1, po2: 1, po3: 1, pa1: 1, cp1: 1 }
  }, rushed.sessionId);

  /* admin */
  const token = process.env.ADMIN_TOKEN || 'local-dev-admin-token-9f2b7c4e1a8d3506';
  const adminGet = async (path) =>
    (await fetch(base + path, { headers: { Authorization: `Bearer ${token}` } })).json();

  const unauth = await fetch(base + '/api/admin/counts');
  check('admin endpoints reject an unauthenticated request', unauth.status === 401);

  const wrongToken = await fetch(base + '/api/admin/counts', {
    headers: { Authorization: 'Bearer wrong-token-of-the-same-length-000000' }
  });
  check('admin endpoints reject a wrong token', wrongToken.status === 401);

  const counts = await adminGet('/api/admin/counts');
  check('the counts view reports all 12 cells', counts.cells?.length === 12);
  check('the counts view reports the per-cell target', counts.targetPerCell === TARGET_PER_CELL);
  check('completed responses are counted', counts.totalCompleted >= 2, `got ${counts.totalCompleted}`);
  check(
    'incomplete sessions are not counted',
    counts.totalCompleted < 24,
    'abandoned sessions must not consume a slot'
  );

  const exported = await adminGet('/api/admin/export');
  check('the export returns only completed responses', exported.responses?.every((r) => r.completed === true));
  check(
    'the export carries no email or hash',
    !JSON.stringify(exported).match(/email(?!Registered)|emailHash|@example\.com/i),
    'experimental data must never carry an identifier'
  );

  const record = exported.responses?.find((r) => r.stage4CompletionSeconds === 42);
  check('the completed record stores its cell', typeof record?.cellId === 'number');
  check('the completed record stores its generation', record?.generation === 'GenX');
  check('the completed record stores both calibration colours', Boolean(record?.likedColourHex && record?.dislikedColourHex));
  check('a 42-second task is not flagged as fast', record?.flaggedFast === false);

  const rushedRecord = exported.responses?.find((r) => r.stage4CompletionSeconds === 3);
  check('a 3-second task is flagged as fast', rushedRecord?.flaggedFast === true);
  check('a flagged-fast response is still saved', rushedRecord?.completed === true);

  /* engagement in the stored record, checked against what the level allowed */
  if (record) {
    const idx = record.customisation?.engagementIndex;
    check(
      'the stored engagement index respects the level ceiling',
      typeof idx === 'number' && idx >= 0 && idx <= 4,
      `got ${idx}`
    );
    if (record.assignedLevel === 2) {
      check('a product-level record stores no skin tone', !('skinTone' in (record.customisation || {})));
    }
  }

  const health = await adminGet('/api/admin/health');
  check('the health check reports its backend', Boolean(health.backend), JSON.stringify(health));
  if (health.backend !== 'mongodb') {
    console.log(`      note: backend is "${health.backend}", not MongoDB`);
  }

  /* The last two admin checks are destructive, and destructive in ways that are silent.
     Cleanup with a 3650-day window deletes every incomplete session -- which, during
     collection, means every participant currently part-way through. Deleting the email
     hashes wipes duplicate control, so people who had already taken part could take part
     again. Neither shows up as an error; both just quietly change the data.
     They are therefore skipped unless the target is local or the flag is explicit. */
  const isLocal = /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])(:|\/|$)/.test(base);
  const destructiveAllowed = isLocal || process.argv.includes('--destructive-ok');

  if (!destructiveAllowed) {
    console.log('      note: skipped the destructive admin checks (cleanup, delete-participants)');
    console.log('            on a remote host. Pass --destructive-ok to include them, but only');
    console.log('            before you have real participants.');
    check(
      'the destructive admin checks are not run against a remote host by default',
      true
    );
  } else {
    if (!isLocal) {
      console.log('      note: --destructive-ok given: running cleanup and delete-participants');
      console.log('            against a REMOTE host. Incomplete sessions and all email hashes');
      console.log('            will be deleted.');
    }

    const cleanup = await (await fetch(base + '/api/admin/cleanup', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ olderThanDays: 3650 })
    })).json();
    check('cleanup reports what it would remove', typeof cleanup.removed === 'number');

    const afterCleanup = await adminGet('/api/admin/counts');
    check(
      'cleanup never removes completed responses',
      afterCleanup.totalCompleted === counts.totalCompleted,
      `${counts.totalCompleted} before, ${afterCleanup.totalCompleted} after`
    );

    const del = await (await fetch(base + '/api/admin/delete-participants', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    })).json();
    check('email hashes can be deleted independently', typeof del.removed === 'number');

    const afterDelete = await adminGet('/api/admin/counts');
    check(
      'deleting email hashes leaves the experimental data intact',
      afterDelete.totalCompleted === counts.totalCompleted,
      'the deletion requirement must not touch responses'
    );
  }

  /* Whichever host this is pointed at, its preview state must be the right one for what
     it is. Both answers are correct, so this reports which one it got rather than
     insisting on either: a dev server should offer it, a deployed Worker must not. */
  const previewProbe = await post('/api/dev/preview', {
    generation: 'GenZ', condition: 'Liked', level: 3, gender: 'Female'
  });
  const previewOpen = previewProbe.status === 200;
  check(
    'this host either offers the preview or has no such route',
    previewOpen || previewProbe.status === 404,
    `got ${previewProbe.status}`
  );
  console.log(`      note: cell preview is ${previewOpen ? 'ENABLED (development)' : 'absent (production)'}`);
}

/* ---------------- report ---------------- */

async function main() {
  if (baseUrl) {
    try {
      await integration(baseUrl.replace(/\/$/, ''));
    } catch (err) {
      failures.push(`integration checks threw: ${err.message}`);
    }
  } else {
    console.log('\n  (no server url given, skipping the participant journey)');
  }

  console.log(`\n  ${passed} passed, ${failures.length} failed`);
  if (failures.length) {
    console.log('\n  Failures:');
    for (const f of failures) console.log(`    - ${f}`);
    console.log('');
    process.exit(1);
  }
  console.log('\n  All checks passed.\n');
}

main();
