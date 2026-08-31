/* The study's rules, in one place.
 *
 * Every decision that matters to the experiment lives here: which cell a participant
 * is assigned to, which controls they are entitled to, what gets stored, and when a
 * response starts counting. It depends on nothing but a store, so it runs unchanged
 * inside the Durable Object, on the plain-Node dev server, and in the test suite.
 *
 * Two invariants are worth stating explicitly, because most of the methods below exist
 * to protect them:
 *
 *  1. An assignment, once made, is never remade. Resume reloads it.
 *  2. `completed` is set in exactly one place, at Stage 5 submission. Until then the
 *     document is invisible to every count, every cap and every export. */

import { COLOUR_POOL, QUESTIONNAIRE_ITEMS, LIKERT_MIN, LIKERT_MAX } from '../public/shared/study-config.js';
import {
  CONDITIONS,
  CONTROLS_BY_LEVEL,
  CUSTOMISATION_CTA,
  CUSTOMISATION_PROMPT,
  FAST_COMPLETION_THRESHOLD_SECONDS,
  LEVELS,
  cellIdFor,
  generationForBirthYear,
  modelForGender,
  revealSentence
} from './study-design.js';
import { assignCell } from './randomise.js';
import { computeEngagement, customisationForLevel } from './engagement.js';

const now = () => new Date();

export class StudyService {
  constructor(store) {
    this.store = store;
  }

  async health() {
    return { ok: true, backend: this.store.backend };
  }

  /* ---------------- Stage 1 ---------------- */

  async startSession() {
    const sessionId = crypto.randomUUID();
    const timestamp = now();

    /* One document per session from the moment consent is given. It is what makes
       resume possible, and it stays `completed: false` until Stage 5 is submitted. */
    await this.store.insertSession({
      sessionId,
      stage: 'onboarding',
      completed: false,
      startedAt: timestamp,
      lastUpdatedAt: timestamp
    });

    return { sessionId };
  }

  /* ---------------- resume ----------------
   *
   * Returns only what the client is allowed to know. The condition, the level and the
   * cell id stay on this side; the treatment payload carries a finished reveal
   * sentence and a yes/no on whether customisation is available. */

  async resume(sessionId) {
    const doc = await this.store.findSession(sessionId);
    if (!doc) return null;

    const state = { stage: doc.stage || 'onboarding' };

    if (doc.birthYear) {
      state.onboarding = {
        birthYear: doc.birthYear,
        gender: doc.gender,
        ex1: doc.ex1,
        ex2: doc.ex2
      };
    }
    if (doc.likedColourHex) {
      state.calibration = {
        likedColourHex: doc.likedColourHex,
        dislikedColourHex: doc.dislikedColourHex
      };
    }
    if (doc.assignedCondition && doc.assignedLevel) {
      state.treatment = this.#treatmentPayload(doc);
    }

    return state;
  }

  /* ---------------- Stage 2 ---------------- */

  async saveOnboarding(sessionId, answers, emailHash) {
    const doc = await this.store.findSession(sessionId);
    if (!doc) return { notFound: true };

    const generation = generationForBirthYear(answers.birthYear);
    if (!generation) return { ineligible: true };

    /* Checked once per session. A session that has already registered its address is
       not re-checked, so a retry after a network error cannot make a participant
       collide with themselves and be turned away from their own study. */
    if (!doc.emailRegistered) {
      if (await this.store.emailExists(emailHash)) return { duplicate: true };
      if (!(await this.store.addEmail(emailHash))) return { duplicate: true };
    }

    await this.store.upsertSession(sessionId, {
      birthYear: Number(answers.birthYear),
      generation,
      gender: answers.gender,
      ex1: Number(answers.ex1),
      ex2: Number(answers.ex2),
      emailRegistered: true,
      stage: 'calibration'
    });

    return { ok: true };
  }

  /* ---------------- Stage 3 ---------------- */

  async saveCalibration(sessionId, likedColourHex, dislikedColourHex) {
    const doc = await this.store.findSession(sessionId);
    if (!doc) return { notFound: true };

    /* Both must be from the pool and must differ. Validated here rather than trusted
       from the client, because these two values decide what the participant is shown
       for the rest of the study. */
    const liked = COLOUR_POOL.find((c) => c.hex === likedColourHex);
    const disliked = COLOUR_POOL.find((c) => c.hex === dislikedColourHex);
    if (!liked || !disliked || liked.hex === disliked.hex) return { invalid: true };

    await this.store.upsertSession(sessionId, {
      likedColourHex: liked.hex,
      dislikedColourHex: disliked.hex,
      stage: 'treatment'
    });

    return { ok: true };
  }

  /* ---------------- Stage 3.5: assignment ----------------
   *
   * Must be atomic: the counts cannot be allowed to change between being read and the
   * cell being written. In the Worker that is guaranteed by running inside a single
   * Durable Object, which processes one request at a time.
   *
   * An assignment already on the document is returned untouched. That is what makes
   * resume safe -- a participant who closes the browser mid-task and comes back must
   * see the same colour and the same options, never a fresh draw. */

  async assign(sessionId) {
    const doc = await this.store.findSession(sessionId);
    if (!doc) return { notFound: true };
    if (!doc.likedColourHex || !doc.generation) return { outOfOrder: true };

    if (doc.assignedCondition && doc.assignedLevel) return this.#treatmentPayload(doc);

    const counts = await this.store.completedCountsByCell();
    const cell = assignCell(doc.generation, counts);
    if (!cell) return { studyFull: true };

    const patch = this.#assignPatch(doc.generation, cell);
    await this.store.upsertSession(sessionId, patch);

    return this.#treatmentPayload({ ...doc, ...patch });
  }

  /* Shared by the real assignment and by the development preview, so a previewed
   * session is written in exactly the same shape as a participant's. */
  #assignPatch(generation, cell) {
    return {
      assignedCondition: cell.condition,
      assignedLevel: cell.level,
      cellId: cellIdFor(generation, cell.condition, cell.level),
      assignedAt: now(),
      stage: 'treatment'
    };
  }

  /* Development only: assignment with the cell named instead of drawn.
   *
   * Reachable solely through the preview route, which the deployed Worker does not
   * register -- see the note in router.js. It deliberately does not consult the
   * per-cell counts, both because a preview should not be refused when a cell is full
   * and because it must not look like a real allocation. The session it produces stays
   * `completed: false` like any other until Stage 5, so it consumes no capacity. */
  async previewAssign(sessionId, condition, level) {
    if (!CONDITIONS.includes(condition) || !LEVELS.includes(level)) return { invalid: true };

    const doc = await this.store.findSession(sessionId);
    if (!doc) return { notFound: true };
    if (!doc.likedColourHex || !doc.generation) return { outOfOrder: true };

    const patch = this.#assignPatch(doc.generation, { condition, level });
    await this.store.upsertSession(sessionId, patch);

    return this.#treatmentPayload({ ...doc, ...patch });
  }

  /* The only shape the client ever sees of its own assignment. Deliberately carries no
   * condition name, no level number and no cell id: a participant reading this
   * response learns the colour they were given and whether they can customise, which
   * is exactly what the screen is about to tell them anyway. */
  #treatmentPayload(doc) {
    const hex = doc.assignedCondition === 'Liked' ? doc.likedColourHex : doc.dislikedColourHex;
    const colour = COLOUR_POOL.find((c) => c.hex === hex);
    const hasControls = (CONTROLS_BY_LEVEL[doc.assignedLevel] || []).length > 0;

    return {
      revealSentence: revealSentence(colour ? colour.name : null, doc.assignedCondition),
      colourHex: hex,
      colourHsl: colour ? { h: colour.h, s: colour.s, l: colour.l } : null,
      model: modelForGender(doc.gender),
      customisation: hasControls
        ? { enabled: true, prompt: CUSTOMISATION_PROMPT, cta: CUSTOMISATION_CTA }
        : { enabled: false },
      draft: doc.stage4Draft || null
    };
  }

  /* Which controls this session is entitled to. The endpoint that builds the bundle
   * asks here rather than trusting anything the browser claims, which is what makes
   * the blinding boundary hold. */
  async controlsFor(sessionId) {
    const doc = await this.store.findSession(sessionId);
    if (!doc || !doc.assignedLevel) return null;
    return CONTROLS_BY_LEVEL[doc.assignedLevel] || [];
  }

  /* ---------------- Stage 4 ---------------- */

  /* Draft saves keep an in-progress customisation across a reload. They never touch
   * `completed`, and the real Stage 4 write clears them. */
  async saveDraft(sessionId, draft) {
    const doc = await this.store.findSession(sessionId);
    if (!doc || doc.stage !== 'treatment') return { ignored: true };
    await this.store.upsertSession(sessionId, { stage4Draft: draft });
    return { ok: true };
  }

  async saveStage4(sessionId, payload) {
    const doc = await this.store.findSession(sessionId);
    if (!doc) return { notFound: true };
    if (!doc.assignedLevel) return { outOfOrder: true };

    const level = doc.assignedLevel;
    const seconds = Math.max(0, Math.round(Number(payload.stage4CompletionSeconds) || 0));

    /* Engagement is derived here, from the level on the document, so a browser cannot
       claim to have used a control it was never given. */
    const customisation = {
      ...customisationForLevel(level, payload.customisation),
      ...computeEngagement(level, payload.customisation)
    };

    await this.store.upsertSession(sessionId, {
      customisation,
      stage4CompletionSeconds: seconds,
      /* Saved either way. A fast run is flagged for review at analysis time rather
         than blocked, because refusing the submission would lose the response and
         still not tell anyone whether it was rushed. */
      flaggedFast: seconds < FAST_COMPLETION_THRESHOLD_SECONDS,
      stage4Draft: null,
      stage: 'questionnaire'
    });

    return { ok: true };
  }

  /* ---------------- Stage 5 ---------------- */

  async submit(sessionId, answers) {
    const doc = await this.store.findSession(sessionId);
    if (!doc) return { notFound: true };
    if (doc.completed) return { ok: true, alreadyComplete: true };
    if (doc.stage !== 'questionnaire') return { outOfOrder: true };

    const values = {};
    for (const item of QUESTIONNAIRE_ITEMS) {
      const v = Number(answers?.[item.id]);
      if (!Number.isInteger(v) || v < LIKERT_MIN || v > LIKERT_MAX) {
        return { invalid: true, field: item.id };
      }
      values[item.id] = v;
    }

    await this.store.upsertSession(sessionId, {
      ...values,
      submittedAt: now(),
      stage: 'done',
      /* The only place this is ever set true. Every count, every cap and every export
         filters on it, so nothing before this line consumes a slot in a cell. */
      completed: true
    });

    return { ok: true };
  }

  /* ---------------- admin ---------------- */

  cellCounts() {
    return this.store.completedCountsByCell();
  }

  async cleanupAbandoned(days) {
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const removed = await this.store.deleteAbandoned(cutoff);
    return { removed, cutoff: cutoff.toISOString() };
  }

  /* Deletes the email hashes and nothing else, which is the deletion requirement for
   * the close of data collection. `responses` holds no address and no link back to
   * one, so the experimental data is untouched and stays analysable. */
  async deleteParticipants() {
    return { removed: await this.store.deleteAllEmails() };
  }

  exportCompleted() {
    return this.store.listCompleted();
  }
}
