/* Stage 4 host.
 *
 * Builds the garment view and owns the completion clock. It does not know, and cannot
 * work out, which customisation level the participant was assigned. It is told only
 * whether customisation is available, and it asks the Worker for the controls that go
 * with this session; the Worker replies with exactly the controls that session is
 * entitled to and nothing else.
 *
 * There is one honest limit to this. The rendering engine has to ship to every
 * participant, because every participant needs the garment drawn, and that engine
 * necessarily contains the skin-tone maths. A determined Level 2 participant who reads
 * several hundred lines of image processing could infer that recolouring skin is
 * possible. What they cannot obtain is the control: it is never in their DOM, never in
 * their JavaScript, and the endpoint that serves it refuses their session. */

import * as rt from '../renderer/tshirt-renderer.js';

const MANIFEST_URL = '/assets/combos/manifest.json';

let manifestPromise = null;
function loadManifest() {
  if (!manifestPromise) {
    manifestPromise = fetch(MANIFEST_URL).then((r) => {
      if (!r.ok) throw new Error('could not load the garment manifest');
      return r.json();
    });
  }
  return manifestPromise;
}

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, v);
  }
  for (const child of children.flat()) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/* ---------------- prepare ----------------
 *
 * Called while the "Preparing your T-shirt" screen is up. Decoding the photograph and
 * precomputing its shading field costs a second or two, and doing it here means it
 * happens behind a loading screen every participant sees for the same reason, rather
 * than as a stall after the reveal. */

export async function prepare(assignment) {
  const manifest = await loadManifest();
  const canvas = h('canvas');

  const renderer = await rt.createRenderer({
    canvas,
    manifest,
    model: assignment.model,
    colourHsl: assignment.colourHsl,
    basePath: '/'
  });

  return { canvas, renderer, manifest };
}

/* ---------------- control bundle ----------------
 *
 * Fetched with the session id in a header rather than loaded as a <script src>, so
 * there is no guessable URL whose contents differ by level, and nothing in the network
 * panel beyond a single request that looks the same for everyone. */

async function fetchControls(sessionId) {
  const res = await fetch('/api/stage4/controls', {
    method: 'POST',
    headers: { 'X-Session-Id': sessionId || '' }
  });
  if (!res.ok) throw new Error('could not load the customisation controls');
  return res.text();
}

/* ---------------- mount ---------------- */

export function mount(handle, options) {
  const { canvas, renderer } = handle;
  const { container, customisation, draft, onContinue, onDraftChange } = options;

  /* The clock starts as Stage 4 loads and stops when Continue is clicked, which is
     what stage4CompletionSeconds measures. */
  const startedAt = Date.now();

  const overlay = h('div', { id: 'textBoxOverlay' });
  const frame = h('div', { class: 'frame' }, canvas, overlay);
  renderer.render();

  const enabled = Boolean(customisation && customisation.enabled);

  const errorSlot = h('span', { class: 'error form-error', hidden: true, role: 'alert' });
  const continueBtn = h('button', { class: 'cta', text: 'Continue' });

  let controlApi = null;

  function collect() {
    const base = {
      sleeveLength: renderer.getSleeve(),
      neckType: renderer.getNeckline(),
      skinTone: renderer.getTone(),
      skinToneDefault: renderer.getDefaultTone(),
      skinToneMoved: renderer.hasAdjustedTone(),
      text: renderer.getText(),
      textColour: renderer.getTextColour(),
      fontSizePx: renderer.getFontSize(),
      textPosition: renderer.getTextPosition()
    };
    /* Controls may contribute or override, but the renderer is the source of truth for
       anything it holds, so a control that was never served cannot fabricate a value. */
    return controlApi && controlApi.collect ? { ...base, ...controlApi.collect() } : base;
  }

  continueBtn.addEventListener('click', async () => {
    errorSlot.hidden = true;
    continueBtn.disabled = true;
    continueBtn.textContent = 'Saving\u2026';

    const payload = {
      customisation: collect(),
      stage4CompletionSeconds: Math.max(0, Math.round((Date.now() - startedAt) / 1000))
    };

    onContinue(payload, (message) => {
      continueBtn.disabled = false;
      continueBtn.textContent = 'Continue';
      errorSlot.textContent = message;
      errorSlot.hidden = false;
    });
  });

  /* ---------------- Level with no controls ----------------
   *
   * The garment is centred on its own rather than sitting beside an empty column,
   * which would invite the question of what is meant to be there. */
  if (!enabled) {
    container.replaceChildren(
      h('div', { class: 'stage4 static-only' },
        frame,
        h('p', { class: 'hint', text: 'Take a moment to look at this T-shirt, then continue.' }),
        continueBtn,
        errorSlot
      )
    );
    return;
  }

  /* ---------------- Level with controls ----------------
   *
   * One layout, and only the right-hand column is ever swapped. Building a second
   * layout that also contained the frame would move the frame out of the first one,
   * because a node can only be in one place, and the garment would vanish the moment
   * customising began. */

  const controlsCol = h('div', { class: 'info-col' });
  const layout = h('div', { class: 'stage4' }, h('div', { class: 'photo-col' }, frame), controlsCol);
  container.replaceChildren(layout);

  controlsCol.replaceChildren(
    h('p', { text: customisation.prompt }),
    h('button', { class: 'cta', text: customisation.cta, onclick: startCustomising })
  );

  async function startCustomising() {
    controlsCol.replaceChildren(h('p', { class: 'hint', text: 'Loading\u2026' }));

    let code;
    try {
      code = await fetchControls(options.sessionId || readSessionId());
    } catch {
      controlsCol.replaceChildren(
        h('p', { class: 'hint', text: 'The customisation options could not be loaded.' }),
        continueBtn,
        errorSlot
      );
      return;
    }

    controlsCol.replaceChildren();

    const ctx = {
      container: controlsCol,
      renderer,
      rt,
      frame,
      overlay,
      h,
      initial: draft || null,
      notifyChange: () => {
        if (onDraftChange) onDraftChange(collect());
      }
    };

    try {
      /* The bundle is a function body the Worker composed for this session. Executing
         it here rather than importing a module keeps the level-specific code off any
         addressable URL. */
      const factory = new Function('ctx', code);
      controlApi = factory(ctx) || null;
    } catch (err) {
      console.debug('controls failed to initialise', err?.message);
    }

    controlsCol.append(continueBtn, errorSlot);

    /* Warming the remaining garment shapes only starts once the controls are up, so it
       never competes with the first paint. */
    renderer.warmReachableCombos();
  }

  /* Restoring a draft has to happen before the controls read their initial state. */
  if (draft) applyDraft(renderer, draft);
}

function applyDraft(renderer, draft) {
  if (typeof draft.text === 'string') renderer.setText(draft.text);
  if (draft.textColour) renderer.setTextColour(draft.textColour);
  if (draft.fontSizePx) renderer.setFontSize(draft.fontSizePx);
  if (draft.textPosition) renderer.setTextPosition(draft.textPosition.cxFrac, draft.textPosition.cyFrac);
  if (typeof draft.skinTone === 'number') renderer.restoreTone(draft.skinTone, draft.skinToneMoved);
  /* Sleeve and neck last: switching a combo is asynchronous and repaints, so it should
     settle after the cheap state has already been applied. */
  if (draft.neckType && draft.neckType !== renderer.getNeckline()) renderer.setNeckline(draft.neckType);
  if (draft.sleeveLength && draft.sleeveLength !== renderer.getSleeve()) renderer.setSleeve(draft.sleeveLength);
}

function readSessionId() {
  try { return localStorage.getItem('chameleon.sessionId'); } catch { return null; }
}
