/* Cell-count-aware randomisation.
 *
 * A participant's generation is already fixed by their birth year, so assignment is a
 * choice among the six condition-by-level cells belonging to that generation. It is
 * not a coin flip for the whole run: cells that have reached the target are withdrawn
 * from the draw, and the choice is uniform over whichever remain open.
 *
 * Only responses with `completed: true` count against a cell. An in-progress or
 * abandoned session holds no slot, which is what stops a run of drop-outs from
 * quietly starving a cell that never actually filled.
 *
 * Uniform over the open cells is the brief's rule and it is kept literally, rather
 * than weighting the draw by remaining capacity. Weighting would converge on a balanced
 * design a little faster, but "each participant was allocated with equal probability to
 * any cell not yet at target" is a sentence that can be written in a methods section
 * without qualification, and that is worth more here than convergence speed. */

import { CONDITIONS, LEVELS, TARGET_PER_CELL, cellIdFor } from './study-design.js';

/* Math.random carries no guarantee of uniformity and is not seeded from a CSPRNG in
 * every runtime. Allocation integrity is the one thing this instrument cannot get
 * wrong, so the draw comes from the platform CSPRNG, and it rejects the tail of the
 * 32-bit range that would otherwise make low indices very slightly more likely. */
function randomIndex(n) {
  if (n <= 0) throw new Error('no cells to choose from');
  if (n === 1) return 0;

  const limit = Math.floor(0x100000000 / n) * n;
  const buf = new Uint32Array(1);
  let value;
  do {
    crypto.getRandomValues(buf);
    value = buf[0];
  } while (value >= limit);

  return value % n;
}

export function openCellsFor(generation, completedCounts) {
  const open = [];
  for (const condition of CONDITIONS) {
    for (const level of LEVELS) {
      const cellId = cellIdFor(generation, condition, level);
      const filled = completedCounts[cellId] || 0;
      if (filled < TARGET_PER_CELL) open.push({ cellId, condition, level, filled });
    }
  }
  return open;
}

/* Returns null when every cell for this generation is full, which the caller turns
 * into the "no longer accepting responses" screen rather than an assignment. */
export function assignCell(generation, completedCounts) {
  const open = openCellsFor(generation, completedCounts);
  if (!open.length) return null;
  return open[randomIndex(open.length)];
}
