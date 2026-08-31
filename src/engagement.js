/* Engagement flags and the derived index.
 *
 * These exist to separate a participant who used the controls they were given from one
 * who left everything at its default and clicked through. Without them two Level 2
 * participants could store identical customisation values and both be counted as
 * "customised" in analysis, when only one of them ever engaged.
 *
 * Each flag is a single before/after comparison at submission against the default in
 * force when Stage 4 loaded. No keystroke tracking, no timestamps, no history of
 * intermediate edits.
 *
 * Skin tone is the one flag not decided by comparing values. Its default is derived
 * from the photograph's own average skin lightness rather than being a constant, and a
 * participant can drag the slider away and back again, landing on a value equal to the
 * default having very much engaged. The renderer therefore reports whether the control
 * was ever touched, and that is what is recorded. */

import { CONTROL_DEFAULTS, ENGAGEMENT_FLAGS_BY_LEVEL } from './study-design.js';

export function computeEngagement(level, customisation) {
  const relevant = ENGAGEMENT_FLAGS_BY_LEVEL[level] || [];

  /* Level 1 has no controls at all, so it carries no flags and an index of zero
     rather than a set of falses that would imply it was offered something. */
  if (!relevant.length) return { engagementIndex: 0 };

  const c = customisation || {};

  const candidates = {
    textEdited: typeof c.text === 'string' && c.text.trim() !== CONTROL_DEFAULTS.text,
    sleeveChanged: Boolean(c.sleeveLength) && c.sleeveLength !== CONTROL_DEFAULTS.sleeveLength,
    neckChanged: Boolean(c.neckType) && c.neckType !== CONTROL_DEFAULTS.neckType,
    skinToneAdjusted: Boolean(c.skinToneMoved)
  };

  const flags = {};
  for (const name of relevant) flags[name] = candidates[name];

  flags.engagementIndex = relevant.reduce((sum, name) => sum + (candidates[name] ? 1 : 0), 0);
  return flags;
}

/* Only the fields belonging to the assigned level are stored. A Level 2 record has no
 * skin-tone value, because there was no skin-tone control to produce one, and writing
 * a default would misrepresent a control that was never shown. */
export function customisationForLevel(level, customisation) {
  const c = customisation || {};
  if (level === 1) return {};

  const stored = {
    text: typeof c.text === 'string' ? c.text : '',
    textColour: c.textColour ?? CONTROL_DEFAULTS.textColour,
    fontSizePx: Number(c.fontSizePx) || CONTROL_DEFAULTS.fontSizePx,
    textPosition: c.textPosition && typeof c.textPosition === 'object'
      ? { cxFrac: Number(c.textPosition.cxFrac), cyFrac: Number(c.textPosition.cyFrac) }
      : null,
    sleeveLength: c.sleeveLength ?? CONTROL_DEFAULTS.sleeveLength,
    neckType: c.neckType ?? CONTROL_DEFAULTS.neckType
  };

  if (level === 3) {
    stored.skinTone = typeof c.skinTone === 'number' ? c.skinTone : null;
    stored.skinToneDefault = typeof c.skinToneDefault === 'number' ? c.skinToneDefault : null;
  }

  return stored;
}
