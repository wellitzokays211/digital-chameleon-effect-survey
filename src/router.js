/* HTTP routing.
 *
 * Written against the Fetch API and given its dependencies rather than reaching for
 * them, so the identical route table serves both the Cloudflare Worker and the
 * plain-Node dev server. `service` is either a Durable Object stub or a StudyService
 * instance -- the method names and signatures are the same either way.
 *
 * The handlers are thin on purpose. Nothing here decides anything about the
 * experiment; they validate shapes, translate results into status codes, and keep the
 * hashing of an email address in the request layer so the plaintext never travels any
 * further in. */

import { hashEmail } from './hash.js';
import { buildControlBundle } from './stage4-controls.js';
import {
  ABANDONED_SESSION_TTL_DAYS,
  TARGET_PER_CELL,
  allCells,
  generationForBirthYear
} from './study-design.js';
import {
  COLOUR_POOL,
  EX1_OPTIONS,
  EX2_OPTIONS,
  GENDER_OPTIONS
} from '../public/shared/study-config.js';

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    }
  });
}

const badRequest = (error) => json({ error }, 400);
const notFound = (error = 'not found') => json({ error }, 404);

function sessionIdFrom(request) {
  const id = request.headers.get('X-Session-Id');
  /* Shaped like a UUID or rejected outright, so a malformed id becomes a clean 400
     here rather than an odd lookup further in. */
  return id && /^[0-9a-f-]{36}$/i.test(id) ? id : null;
}

async function readJson(request) {
  try { return await request.json(); } catch { return null; }
}

/* Constant-time comparison, so a wrong admin token cannot be recovered a character at
 * a time by timing the response. */
function tokensMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/* A representative birth year for a generation, found by asking the design rather than
 * by hard-coding a year that would silently go stale if the ranges moved. */
function birthYearForGeneration(generation) {
  const thisYear = new Date().getFullYear();
  for (let year = 1940; year <= thisYear; year++) {
    if (generationForBirthYear(year) === generation) return year;
  }
  return null;
}

export function createRouter({ service, env, serveAsset, preview = false }) {
  const svc = () => (typeof service === 'function' ? service() : service);

  function requireAdmin(request) {
    if (!env.ADMIN_TOKEN) return json({ error: 'admin endpoints are not configured' }, 503);
    const header = request.headers.get('Authorization') || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!tokensMatch(token, env.ADMIN_TOKEN)) return json({ error: 'unauthorised' }, 401);
    return null;
  }

  /* ---------------- participant endpoints ---------------- */

  async function handleStart() {
    return json(await svc().startSession());
  }

  async function handleResume(request) {
    const sessionId = sessionIdFrom(request);
    if (!sessionId) return badRequest('missing session');

    const state = await svc().resume(sessionId);
    /* A 404 is meaningful to the client: it discards the stored id and starts fresh,
       which is what should happen to an id from a cleaned-up or foreign session. */
    if (!state) return notFound('unknown session');
    return json(state);
  }

  async function handleOnboarding(request) {
    const sessionId = sessionIdFrom(request);
    if (!sessionId) return badRequest('missing session');

    const body = await readJson(request);
    if (!body) return badRequest('invalid body');

    const { birthYear, gender, email, ex1, ex2 } = body;
    if (!birthYear || !gender || !email || !ex1 || !ex2) return badRequest('missing fields');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(email))) return badRequest('invalid email');

    /* Membership, not merely presence. An unrecognised gender is otherwise stored
       verbatim and falls through to the default model without complaint, and an
       out-of-range experience answer is stored as a number nobody was ever offered.
       Both would reach the dataset looking like real answers. */
    if (!GENDER_OPTIONS.includes(gender)) return badRequest('invalid gender');
    if (!EX1_OPTIONS.some((o) => o.value === Number(ex1))) return badRequest('invalid ex1');
    if (!EX2_OPTIONS.some((o) => o.value === Number(ex2))) return badRequest('invalid ex2');

    /* Hashed in the request layer so the plaintext address is never passed into the
       service and cannot end up in an argument log or a stack trace. */
    const emailHash = await hashEmail(email, env.EMAIL_HASH_SALT);

    const result = await svc().saveOnboarding(sessionId, { birthYear, gender, ex1, ex2 }, emailHash);
    if (result.notFound) return notFound('unknown session');
    return json(result);
  }

  async function handleCalibration(request) {
    const sessionId = sessionIdFrom(request);
    if (!sessionId) return badRequest('missing session');

    const body = await readJson(request);
    if (!body) return badRequest('invalid body');

    const result = await svc().saveCalibration(
      sessionId, body.likedColourHex, body.dislikedColourHex
    );
    if (result.notFound) return notFound('unknown session');
    if (result.invalid) return badRequest('expected two different colours from the pool');
    return json(result);
  }

  async function handleAssign(request) {
    const sessionId = sessionIdFrom(request);
    if (!sessionId) return badRequest('missing session');

    const result = await svc().assign(sessionId);
    if (result.notFound) return notFound('unknown session');
    if (result.outOfOrder) return badRequest('calibration is not complete');
    return json(result);
  }

  /* ---------------- Stage 4 controls ----------------
   *
   * The blinding boundary. The level is read from the session on the server and the
   * bundle is built from it; nothing the browser sends influences which controls come
   * back. A participant cannot request a level they were not assigned, because they
   * never name a level -- they name only their own session. */

  async function handleControls(request) {
    const sessionId = sessionIdFrom(request);
    if (!sessionId) return badRequest('missing session');

    const controls = await svc().controlsFor(sessionId);
    if (controls === null) return notFound('unknown session');

    return new Response(buildControlBundle(controls), {
      headers: {
        'Content-Type': 'text/javascript; charset=utf-8',
        /* Never cached. A shared cache holding one participant's bundle and serving
           it to another would break both the blinding and the study. */
        'Cache-Control': 'no-store, private',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }

  async function handleDraft(request) {
    const sessionId = sessionIdFrom(request);
    if (!sessionId) return badRequest('missing session');

    const body = await readJson(request);
    if (!body) return badRequest('invalid body');

    return json(await svc().saveDraft(sessionId, body.draft || null));
  }

  async function handleStage4(request) {
    const sessionId = sessionIdFrom(request);
    if (!sessionId) return badRequest('missing session');

    const body = await readJson(request);
    if (!body) return badRequest('invalid body');

    const result = await svc().saveStage4(sessionId, body);
    if (result.notFound) return notFound('unknown session');
    if (result.outOfOrder) return badRequest('no assignment on this session');
    return json(result);
  }

  async function handleSubmit(request) {
    const sessionId = sessionIdFrom(request);
    if (!sessionId) return badRequest('missing session');

    const body = await readJson(request);
    if (!body) return badRequest('invalid body');

    const result = await svc().submit(sessionId, body.answers);
    if (result.notFound) return notFound('unknown session');
    if (result.invalid) return badRequest(`invalid answer for ${result.field}`);
    if (result.outOfOrder) return badRequest('the task is not complete');
    return json(result);
  }

  /* ---------------- admin endpoints ---------------- */

  async function handleAdminCounts() {
    const counts = await svc().cellCounts();

    /* Reported as the full twelve-cell grid rather than only the cells that happen to
       have responses, so a cell sitting at zero is visible instead of absent. */
    const cells = allCells().map((cell) => ({
      ...cell,
      completed: counts[cell.cellId] || 0,
      remaining: Math.max(0, TARGET_PER_CELL - (counts[cell.cellId] || 0))
    }));

    return json({
      targetPerCell: TARGET_PER_CELL,
      totalTarget: TARGET_PER_CELL * 12,
      totalCompleted: cells.reduce((sum, c) => sum + c.completed, 0),
      open: cells.filter((c) => c.remaining > 0).length,
      cells
    });
  }

  async function handleAdminCleanup(request) {
    const body = await readJson(request);
    const days = Number(body?.olderThanDays) || ABANDONED_SESSION_TTL_DAYS;
    return json(await svc().cleanupAbandoned(days));
  }

  async function handleAdminDeleteParticipants() {
    return json(await svc().deleteParticipants());
  }

  async function handleAdminExport() {
    const rows = await svc().exportCompleted();
    return json({ count: rows.length, responses: rows });
  }

  async function handleAdminHealth() {
    return json(await svc().health());
  }

  /* ---------------- development preview ----------------
   *
   * Seeds a session that is already consented, onboarded and calibrated, and assigns it
   * to a named cell, so all three customisation levels can be inspected deliberately
   * instead of by restarting until randomisation happens to deal them out.
   *
   * It is gated structurally rather than by a runtime environment check. The route is
   * added to the table only when the host passes `preview: true`; tools/dev-server.mjs
   * does, src/index.js does not. On the deployed Worker there is therefore no such path
   * to call -- not a guarded one, an absent one -- and no request, token or header can
   * conjure it back. */

  async function handlePreview(request) {
    const body = await readJson(request);
    if (!body) return badRequest('invalid body');

    const level = Number(body.level);
    const birthYear = birthYearForGeneration(body.generation);
    if (!birthYear) return badRequest('unknown generation');

    const gender = body.gender || 'Female';
    if (!GENDER_OPTIONS.includes(gender)) return badRequest('unknown gender');

    const { sessionId } = await svc().startSession();

    /* Seeded through the real Stage 2 and Stage 3 methods, so the document is identical
       in shape to a participant's and Stage 4 exercises the same code paths. The
       throwaway address keeps the duplicate check meaningful across repeat previews. */
    const emailHash = await hashEmail(
      `preview-${crypto.randomUUID()}@example.invalid`, env.EMAIL_HASH_SALT
    );
    const onboarded = await svc().saveOnboarding(
      sessionId,
      { birthYear, gender, ex1: 4, ex2: 4 },
      emailHash
    );
    if (!onboarded.ok) return badRequest('could not seed onboarding');

    /* Two visibly different hues, so which one the reveal names tells you at a glance
       whether you are looking at the liked or the disliked condition. */
    const calibrated = await svc().saveCalibration(
      sessionId, COLOUR_POOL[0].hex, COLOUR_POOL[5].hex
    );
    if (!calibrated.ok) return badRequest('could not seed calibration');

    const assignment = await svc().previewAssign(sessionId, body.condition, level);
    if (assignment.invalid) return badRequest('unknown condition or level');
    if (assignment.notFound || assignment.outOfOrder) return badRequest('could not seed assignment');

    return json({ sessionId, assignment });
  }

  const ROUTES = {
    'POST /api/session/start': handleStart,
    'POST /api/session/resume': handleResume,
    'POST /api/onboarding': handleOnboarding,
    'POST /api/calibration': handleCalibration,
    'POST /api/assign': handleAssign,
    'POST /api/stage4/controls': handleControls,
    'POST /api/stage4/draft': handleDraft,
    'POST /api/stage4': handleStage4,
    'POST /api/submit': handleSubmit,
    ...(preview ? { 'POST /api/dev/preview': handlePreview } : {})
  };

  const ADMIN_ROUTES = {
    'GET /api/admin/health': handleAdminHealth,
    'GET /api/admin/counts': handleAdminCounts,
    'GET /api/admin/export': handleAdminExport,
    'POST /api/admin/cleanup': handleAdminCleanup,
    'POST /api/admin/delete-participants': handleAdminDeleteParticipants
  };

  return async function handle(request) {
    const url = new URL(request.url);
    const key = `${request.method} ${url.pathname}`;

    try {
      const adminHandler = ADMIN_ROUTES[key];
      if (adminHandler) {
        const denied = requireAdmin(request);
        return denied || (await adminHandler(request));
      }

      const handler = ROUTES[key];
      if (handler) return await handler(request);

      if (url.pathname.startsWith('/api/')) return notFound('no such endpoint');

      return await serveAsset(request, url);
    } catch (err) {
      /* Logged without any session id or assignment detail: a server log is not a
         place to put anything that would deanonymise a participant or reveal a
         condition. */
      console.error('unhandled error on', key, err?.message);
      return json({ error: 'internal error' }, 500);
    }
  };
}
