/* Server-only experimental design.
 *
 * Bundled into the Worker and never served to a browser. Everything that would tell a
 * participant something about the design they are not supposed to know lives here:
 * the condition names, the three customisation levels, the cell map, the allocation
 * targets and the reveal wording for both conditions.
 *
 * The client-safe half is public/shared/study-config.js. Keeping the two apart is
 * what makes the blinding requirement structural rather than a matter of remembering
 * not to log the wrong thing. */

export const GENERATIONS = ['GenX', 'GenZ'];
export const CONDITIONS = ['Liked', 'Disliked'];
export const LEVELS = [1, 2, 3];

export const BIRTH_YEAR_RANGES = [
  { generation: 'GenX', min: 1965, max: 1980 },
  { generation: 'GenZ', min: 1997, max: 2008 }
];

export function generationForBirthYear(year) {
  const y = Number(year);
  if (!Number.isInteger(y)) return null;
  const match = BIRTH_YEAR_RANGES.find((r) => y >= r.min && y <= r.max);
  return match ? match.generation : null;
}

/* ---------------- the 12 cells ----------------
 *
 * Generation comes from the birth year and is never randomised; condition and level
 * are assigned. The arithmetic reproduces the brief's table exactly: Gen X in cells
 * 1-6 and Gen Z in 7-12, Liked before Disliked, level ascending within each. */

export function cellIdFor(generation, condition, level) {
  const g = GENERATIONS.indexOf(generation);
  const c = CONDITIONS.indexOf(condition);
  const lvl = Number(level);
  if (g < 0 || c < 0 || !LEVELS.includes(lvl)) return null;
  return g * 6 + c * 3 + lvl;
}

export function allCells() {
  const cells = [];
  for (const generation of GENERATIONS) {
    for (const condition of CONDITIONS) {
      for (const level of LEVELS) {
        cells.push({ cellId: cellIdFor(generation, condition, level), generation, condition, level });
      }
    }
  }
  return cells.sort((a, b) => a.cellId - b.cellId);
}

/* ---------------- allocation targets and data quality ---------------- */

export const TARGET_PER_CELL = 20;
export const TOTAL_TARGET = TARGET_PER_CELL * 12;

/* A Stage 4 faster than this is still saved, but flagged so it can be reviewed or
 * excluded at analysis time rather than silently blocked at submission. */
export const FAST_COMPLETION_THRESHOLD_SECONDS = 15;

/* Housekeeping only: how stale an incomplete session must be before cleanup will
 * remove it. Never applied to completed responses. */
export const ABANDONED_SESSION_TTL_DAYS = 30;

/* ---------------- model selection ----------------
 *
 * The prototype ships a female and a male model. It is never a participant-facing
 * control here: exposing it would add an uncontrolled variable to a study about
 * skin-tone congruence. It is derived from the gender answer instead, and participants
 * who decline to state one receive the default, so declining carries no visible
 * consequence. */

export const DEFAULT_MODEL = 'female';

export function modelForGender(gender) {
  if (gender === 'Male') return 'male';
  if (gender === 'Female') return 'female';
  return DEFAULT_MODEL;
}

/* ---------------- control defaults ----------------
 *
 * Engagement is a before/after comparison against these, which are the defaults in
 * force the moment Stage 4 loads. Skin tone is absent: the renderer derives its
 * starting position from the photograph's own average skin lightness, so the baseline
 * is recorded per session at load rather than being a constant. */

export const CONTROL_DEFAULTS = {
  text: '',
  sleeveLength: 'short',
  neckType: 'round',
  textColour: 'black',
  fontSizePx: 28
};

/* Which controls each level may have. The Worker uses this both to build the control
 * bundle and to refuse to serve a control a session is not entitled to. */
export const CONTROLS_BY_LEVEL = {
  1: [],
  2: ['text', 'sleeve', 'neck'],
  3: ['text', 'sleeve', 'neck', 'skinTone']
};

/* Which engagement booleans count toward engagementIndex at each level.
 *
 * The brief specifies four at Level 2 and five at Level 3, including a
 * `graphicSelected` flag for a graphic/icon picker. The prototype has no such
 * control and one was not added, so that flag has no way to ever be true and is
 * omitted rather than stored as a permanent false that would depress the index.
 * Maxima are therefore 3 at Level 2 and 4 at Level 3.
 *
 * The text sub-controls the prototype carries -- font size, ink colour and the drag
 * position -- are stored for completeness but do not count toward engagement, so the
 * index stays a count of distinct customisation decisions rather than rewarding one
 * participant twice for fiddling with the same feature. */
export const ENGAGEMENT_FLAGS_BY_LEVEL = {
  1: [],
  2: ['textEdited', 'sleeveChanged', 'neckChanged'],
  3: ['textEdited', 'sleeveChanged', 'neckChanged', 'skinToneAdjusted']
};

/* ---------------- reveal wording ----------------
 *
 * Identical for both conditions bar the final clause, matched in length and tone, so
 * that neither version tells a participant how to feel about the colour they were
 * given moments before they rate it. Generated on the server and sent to the client as
 * a finished sentence: the client is never told which condition produced it. */
export function revealSentence(colourName, condition) {
  const clause = condition === 'Liked' ? 'like the most' : 'like the least';
  const stem = colourName ? `This T-shirt is in ${colourName}.` : 'This T-shirt is in this colour.';
  /* The newline is deliberate. The client renders this with white-space: pre-line so the
     attribution sits on its own line, which keeps the colour name from competing with it
     for attention at the moment the participant first sees the garment. */
  return `${stem}\n(The colour you told us you ${clause})`;
}

/* Identical wording for Level 2 and Level 3, so a Level 2 participant sees nothing
 * implying a Level 3 exists. */
export const CUSTOMISATION_PROMPT = 'You can now customise this T-shirt.';
export const CUSTOMISATION_CTA = 'Start customising';
export const CUSTOMISATION_CHANGES_HEADING = 'Changes you can make:';

/* What the participant is told they may change, before they commit to starting.
 *
 * Built here rather than in the browser: the list differs by level, so holding the
 * mapping client-side would hand every participant the shape of the whole design. A
 * Level 2 participant receives three items and no reason to think a fourth exists.
 *
 * The Level 3 skin-tone item asks participants to match their own tone. This is the
 * researcher's decision, taken knowingly, and it changes what the skin-tone measure
 * means: matching is now partly an instruction followed rather than a preference
 * revealed, so it reads as matching under instruction and belongs in the limitations.
 * The control itself still gives no reference, no target and no closeness feedback, so
 * how near a participant lands remains their own judgement. Anyone changing this
 * wording is changing the construct, not the copy. */
export const CUSTOMISATION_CHANGES_BY_LEVEL = {
  1: [],
  2: ['Add text', 'Change the sleeve length', 'Change the neck type'],
  3: [
    'Add text',
    'Change the sleeve length',
    'Change the neck type',
    "Change the model's skin tone to match yours"
  ]
};

/* ---------------- progress ---------------- */

export const STAGES = ['onboarding', 'calibration', 'treatment', 'questionnaire', 'done'];
