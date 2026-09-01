/* Participant flow controller.
 *
 * Owns the session, the stage machine and every screen except the Stage 4 controls,
 * which are the Worker's job. Nothing in this file knows the participant's condition
 * or customisation level: the server hands over a finished reveal sentence and a
 * yes/no on whether customisation is available, and that is all the client is told.
 * Reading this file end to end tells a curious participant nothing about the design. */

import {
  COLOUR_POOL,
  colourByHex,
  isEligibleBirthYear,
  INELIGIBLE_BIRTH_YEAR_MESSAGE,
  GENDER_OPTIONS,
  EX1_OPTIONS,
  EX2_OPTIONS,
  QUESTIONNAIRE_ITEMS,
  LIKERT_MIN,
  LIKERT_MAX,
  LIKERT_MIN_LABEL,
  LIKERT_MAX_LABEL,
  STEP_LABELS,
  LOADING_FLOOR_MS,
  CONSENT_TEXT,
  MESSAGES
} from './shared/study-config.js';

const SESSION_KEY = 'chameleon.sessionId';

const app = document.getElementById('app');
const stepEl = document.getElementById('stepIndicator');

let sessionId = null;

/* ---------------- session storage ----------------
 *
 * localStorage rather than a cookie so the id survives a closed tab and a reopened
 * browser on the same device without any server round trip to re-issue it. Private
 * browsing can throw on access, so every touch is guarded: a participant whose browser
 * refuses storage still gets a working study, just without resume. */

function readSession() {
  try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
}
function writeSession(id) {
  try { localStorage.setItem(SESSION_KEY, id); } catch { /* resume unavailable */ }
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch { /* nothing to do */ }
}

/* ---------------- api ---------------- */

async function api(path, body) {
  const headers = { 'Content-Type': 'application/json' };
  if (sessionId) headers['X-Session-Id'] = sessionId;

  const res = await fetch(path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body ?? {})
  });

  let payload = null;
  try { payload = await res.json(); } catch { /* non-JSON error page */ }

  if (!res.ok) {
    const err = new Error((payload && payload.error) || `request failed (${res.status})`);
    err.status = res.status;
    err.payload = payload;
    throw err;
  }
  return payload || {};
}

/* ---------------- tiny dom helper ---------------- */

function h(tag, props, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'html') el.innerHTML = v;
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

function screen(stage, ...nodes) {
  app.replaceChildren(...nodes);
  const label = STEP_LABELS[stage];
  stepEl.textContent = label || '';
  stepEl.hidden = !label;
  window.scrollTo(0, 0);
}

/* ---------------- reusable inputs ---------------- */

function radioGroup({ name, options, value, onChange }) {
  const group = h('div', { class: 'options', role: 'radiogroup' });
  for (const opt of options) {
    const optValue = typeof opt === 'object' ? opt.value : opt;
    const optLabel = typeof opt === 'object' ? opt.label : opt;
    const input = h('input', {
      type: 'radio',
      name,
      value: String(optValue),
      checked: String(value) === String(optValue)
    });
    const row = h('label', { class: 'option' + (String(value) === String(optValue) ? ' selected' : '') },
      input,
      h('span', { class: 'option-text', text: optLabel })
    );
    input.addEventListener('change', () => {
      group.querySelectorAll('.option').forEach((n) => n.classList.remove('selected'));
      row.classList.add('selected');
      onChange(optValue);
    });
    group.append(row);
  }
  return group;
}

function fieldError() {
  return h('span', { class: 'error', hidden: true, role: 'alert' });
}

function showError(node, message) {
  node.textContent = message;
  node.hidden = false;
}
function hideError(node) {
  node.hidden = true;
}

/* ---------------- Stage 1: consent ---------------- */

function renderConsent() {
  const agreed = { value: false };
  const err = fieldError();

  const checkbox = h('input', { type: 'checkbox' });
  const proceed = h('button', { class: 'cta', disabled: true, text: 'I agree and proceed' });

  checkbox.addEventListener('change', () => {
    agreed.value = checkbox.checked;
    proceed.disabled = !checkbox.checked;
    if (checkbox.checked) hideError(err);
  });

  proceed.addEventListener('click', async () => {
    if (!agreed.value) return showError(err, 'Please confirm the statement above to continue.');
    proceed.disabled = true;
    proceed.textContent = 'Starting\u2026';
    try {
      const { sessionId: id } = await api('/api/session/start');
      sessionId = id;
      writeSession(id);
      renderOnboarding({});
    } catch {
      proceed.disabled = false;
      proceed.textContent = 'I agree and proceed';
      showError(err, MESSAGES.genericError);
    }
  });

  screen('consent',
    h('div', { class: 'card' },
      h('h1', { text: 'Information and consent' }),
      h('p', { class: 'consent-body', text: CONSENT_TEXT }),
      h('label', { class: 'checkbox-row' },
        checkbox,
        h('span', { text: 'I have read and understood the above, I am 18 or older, and I consent to participate.' })
      ),
      proceed,
      err,
      /* Declining writes nothing: no session is started until the button above is
         clicked, so there is no record to remove. */
      h('button', {
        class: 'cta secondary',
        text: 'I do not wish to participate',
        onclick: () => renderTerminal('Thank you', MESSAGES.declined)
      })
    )
  );
}

/* ---------------- Stage 2: onboarding ---------------- */

function renderOnboarding(prefill) {
  const data = {
    birthYear: prefill.birthYear ?? '',
    gender: prefill.gender ?? null,
    email: prefill.email ?? '',
    ex1: prefill.ex1 ?? null,
    ex2: prefill.ex2 ?? null
  };

  const yearInput = h('input', {
    type: 'number',
    class: 'text-input',
    inputmode: 'numeric',
    placeholder: 'e.g. 1975',
    value: data.birthYear,
    min: '1900',
    max: '2020'
  });
  const yearErr = fieldError();
  yearInput.addEventListener('input', () => {
    data.birthYear = yearInput.value.trim();
    hideError(yearErr);
    yearInput.removeAttribute('aria-invalid');
  });

  const genderErr = fieldError();
  const emailInput = h('input', {
    type: 'email',
    class: 'text-input',
    placeholder: 'you@example.com',
    autocomplete: 'email',
    value: data.email
  });
  const emailErr = fieldError();
  emailInput.addEventListener('input', () => {
    data.email = emailInput.value.trim();
    hideError(emailErr);
    emailInput.removeAttribute('aria-invalid');
  });

  const ex1Err = fieldError();
  const ex2Err = fieldError();
  const formErr = fieldError();
  formErr.classList.add('form-error');

  const submit = h('button', { class: 'cta', text: 'Continue' });

  submit.addEventListener('click', async () => {
    hideError(formErr);
    let ok = true;

    if (!data.birthYear) {
      showError(yearErr, 'Please enter your birth year.');
      yearInput.setAttribute('aria-invalid', 'true');
      ok = false;
    } else if (!/^\d{4}$/.test(data.birthYear)) {
      showError(yearErr, 'Please enter a four-digit year.');
      yearInput.setAttribute('aria-invalid', 'true');
      ok = false;
    } else if (!isEligibleBirthYear(data.birthYear)) {
      showError(yearErr, INELIGIBLE_BIRTH_YEAR_MESSAGE);
      yearInput.setAttribute('aria-invalid', 'true');
      ok = false;
    }

    if (!data.gender) { showError(genderErr, 'Please select an option.'); ok = false; }

    if (!data.email) {
      showError(emailErr, 'Please enter your email address.');
      emailInput.setAttribute('aria-invalid', 'true');
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
      showError(emailErr, 'Please enter a valid email address.');
      emailInput.setAttribute('aria-invalid', 'true');
      ok = false;
    }

    if (!data.ex1) { showError(ex1Err, 'Please select an option.'); ok = false; }
    if (!data.ex2) { showError(ex2Err, 'Please select an option.'); ok = false; }

    if (!ok) {
      app.querySelector('.error:not([hidden])')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Saving\u2026';
    try {
      const res = await api('/api/onboarding', {
        birthYear: Number(data.birthYear),
        gender: data.gender,
        email: data.email,
        ex1: Number(data.ex1),
        ex2: Number(data.ex2)
      });

      /* Duplicate control happens here rather than at submission, so a returning
         participant is turned away before investing time in the task. */
      if (res.duplicate) {
        clearSession();
        return renderTerminal('Thank you', MESSAGES.duplicate);
      }
      if (res.ineligible) {
        submit.disabled = false;
        submit.textContent = 'Continue';
        return showError(yearErr, INELIGIBLE_BIRTH_YEAR_MESSAGE);
      }
      renderCalibration({});
    } catch {
      submit.disabled = false;
      submit.textContent = 'Continue';
      showError(formErr, MESSAGES.genericError);
    }
  });

  screen('onboarding',
    h('div', { class: 'card' },
      h('h1', { text: 'A few questions about you' }),
      h('p', { class: 'lede', text: 'All fields are required.' }),

      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'What is your birth year?' }),
        yearInput,
        yearErr
      ),

      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'What is your gender?' }),
        radioGroup({
          name: 'gender',
          options: GENDER_OPTIONS,
          value: data.gender,
          onChange: (v) => { data.gender = v; hideError(genderErr); }
        }),
        genderErr
      ),

      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'What is your email address?' }),
        h('p', { class: 'field-hint', text: 'Used only to prevent duplicate responses. It is stored separately from your answers and deleted once data collection closes.' }),
        emailInput,
        emailErr
      ),

      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'For how long have you been shopping online?' }),
        radioGroup({
          name: 'ex1',
          options: EX1_OPTIONS,
          value: data.ex1,
          onChange: (v) => { data.ex1 = v; hideError(ex1Err); }
        }),
        ex1Err
      ),

      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: 'How often do you make online purchases?' }),
        radioGroup({
          name: 'ex2',
          options: EX2_OPTIONS,
          value: data.ex2,
          onChange: (v) => { data.ex2 = v; hideError(ex2Err); }
        }),
        ex2Err
      ),

      submit,
      formErr
    )
  );
}

/* ---------------- Stage 3: calibration ---------------- */

function renderCalibration(prefill) {
  let liked = prefill.likedColourHex ?? null;

  /* Tapping a swatch locks it and stamps the badge across it, so the participant can see
     at a glance which colour they have committed to rather than inferring it from a thin
     border. The lock still moves if they tap elsewhere, and only Continue commits it: a
     mis-tap must not silently decide the colour the rest of the study hangs on.

     Both the subheading and the badge name which of the two choices is being made. The
     two screens are otherwise near-identical -- same heading, same grid, same layout --
     so without that, a participant who glanced past the prompt could give their most
     liked colour twice and never notice. That mistake is invisible in the data: the two
     hexes are simply wrong, not missing. */
  function pool({ title, subtitle, prompt, spent, spentLabel, lockLabel, initial, onConfirm }) {
    let chosen = initial || null;
    const buttons = new Map();
    const grid = h('div', { class: 'swatch-pool' });

    for (const colour of COLOUR_POOL) {
      const isSpent = spent?.hex === colour.hex;
      const btn = h('button', {
        type: 'button',
        class: 'pool-swatch',
        style: `background:${colour.hex}`,
        title: isSpent ? `${colour.name} (locked as your ${spentLabel.toLowerCase()})` : colour.name,
        'aria-label': isSpent ? `${colour.name}, locked as your ${spentLabel.toLowerCase()}` : colour.name,
        disabled: isSpent
      });
      if (!isSpent) {
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => { chosen = colour; hideError(err); paint(); });
      }
      buttons.set(colour.hex, btn);
      grid.append(btn);
    }

    const cta = h('button', { class: 'cta', text: 'Continue', disabled: true });
    const err = fieldError();
    err.classList.add('form-error');

    function paint() {
      for (const [hex, btn] of buttons) {
        const isChosen = chosen?.hex === hex;
        /* A spent colour is disabled, so it can never also be the chosen one. */
        const role = isChosen ? lockLabel : spent?.hex === hex ? spentLabel : null;
        btn.classList.toggle('locked', Boolean(role));
        if (!btn.disabled) btn.setAttribute('aria-pressed', String(isChosen));
        /* The newline is deliberate, and rendered with white-space: pre-line. "Locked"
           states what happened; the line under it states which of the two choices this
           is, and stacking them keeps both legible inside a swatch. */
        btn.replaceChildren(
          ...(role ? [h('span', { class: 'swatch-lock' }, h('span', { text: `Locked\n${role}` }))] : [])
        );
      }
      cta.disabled = !chosen;
    }

    cta.addEventListener('click', () => {
      if (chosen) onConfirm(chosen, cta, err);
    });
    paint();

    return h('div', { class: 'card' },
      h('h1', { text: title }),
      h('h2', { text: subtitle }),
      h('p', { class: 'lede', text: prompt }),
      grid,
      h('p', { class: 'hint', text: 'Your choice locks when you tap it. You can change it until you continue.' }),
      cta,
      err
    );
  }

  function askLiked() {
    screen('calibration', pool({
      title: 'Colour preferences',
      subtitle: 'Most Liked Colour',
      prompt: 'From the colours below, select the one you would most like to see on a casual T-shirt.',
      spent: null,
      spentLabel: null,
      lockLabel: 'Most Liked',
      initial: colourByHex(liked),
      onConfirm: (colour) => { liked = colour.hex; askDisliked(); }
    }));
  }

  /* The liked swatch stays in the grid, locked, rather than being removed: the grid does
     not reflow and the second choice is made against the same spatial layout as the first. */
  function askDisliked() {
    screen('calibration', pool({
      title: 'Colour preferences',
      subtitle: 'Least Liked Colour',
      prompt: 'Now select the colour you would least like to see on a casual T-shirt.',
      spent: colourByHex(liked),
      spentLabel: 'Most Liked',
      lockLabel: 'Least Liked',
      initial: null,
      onConfirm: async (colour, cta, err) => {
        cta.disabled = true;
        try {
          await api('/api/calibration', { likedColourHex: liked, dislikedColourHex: colour.hex });
          renderReveal();
        } catch {
          cta.disabled = false;
          showError(err, MESSAGES.genericError);
        }
      }
    }));
  }

  askLiked();
}

/* ---------------- Stage 3.5: loading and reveal ----------------
 *
 * Randomisation fires the moment this stage begins, so the condition, level and cell
 * are locked in before anything is shown. The loading screen is identical for every
 * participant, and it is also where the first garment's precomputation happens, so the
 * reveal and the task itself appear without a second wait. */

let stage4Module = null;
let preparedGarment = null;

async function loadStage4Module() {
  if (!stage4Module) stage4Module = await import('./stage4/host.js');
  return stage4Module;
}

function renderReveal(existing) {
  screen('reveal',
    h('div', { class: 'card' },
      h('div', { class: 'loading' },
        h('div', { class: 'spinner', role: 'status', 'aria-label': 'Preparing' }),
        h('p', { text: 'Preparing your T-shirt\u2026' })
      )
    )
  );

  const floor = new Promise((resolve) => setTimeout(resolve, LOADING_FLOOR_MS));

  (async () => {
    try {
      const assignment = existing || await api('/api/assign');
      if (assignment.studyFull) {
        await floor;
        return renderTerminal('Thank you', MESSAGES.studyFull);
      }

      const host = await loadStage4Module();
      preparedGarment = await host.prepare(assignment);

      await floor;
      showReveal(assignment);
    } catch (err) {
      await floor;
      const retry = h('button', { class: 'cta', text: 'Try again', onclick: () => renderReveal(existing) });
      screen('reveal',
        h('div', { class: 'card centred' },
          h('h1', { text: 'We could not prepare your T-shirt' }),
          h('p', { class: 'lede', text: MESSAGES.genericError }),
          retry
        )
      );
      console.debug('reveal failed', err?.message);
    }
  })();
}

function showReveal(assignment) {
  screen('reveal',
    h('div', { class: 'card centred' },
      h('div', { class: 'reveal-swatch', style: `background:${assignment.colourHex}` }),
      h('p', { class: 'reveal-sentence', text: assignment.revealSentence }),
      h('button', { class: 'cta', text: 'Continue', onclick: () => renderTreatment(assignment) })
    )
  );
}

/* ---------------- Stage 4: treatment ---------------- */

async function renderTreatment(assignment) {
  const host = await loadStage4Module();
  const container = h('div', { class: 'card wide' });
  screen('treatment', container);

  if (!preparedGarment) preparedGarment = await host.prepare(assignment);

  host.mount(preparedGarment, {
    container,
    sessionId,
    customisation: assignment.customisation,
    draft: assignment.draft || null,
    onDraftChange: (draft) => {
      /* Best effort. A failed draft save must never interrupt the task; the
         authoritative write happens when Continue is clicked. */
      api('/api/stage4/draft', { draft }).catch(() => {});
    },
    onContinue: async (payload, done) => {
      try {
        await api('/api/stage4', payload);
        preparedGarment = null;
        renderQuestionnaire();
      } catch {
        done(MESSAGES.genericError);
      }
    }
  });
}

/* ---------------- Stage 5: questionnaire ---------------- */

function renderQuestionnaire() {
  const answers = {};
  const errors = {};

  const items = QUESTIONNAIRE_ITEMS.map((item) => {
    const scale = h('div', { class: 'likert-scale', role: 'radiogroup', 'aria-label': item.text });
    const points = [];

    for (let v = LIKERT_MIN; v <= LIKERT_MAX; v++) {
      const input = h('input', { type: 'radio', name: item.id, value: String(v) });
      const point = h('label', { class: 'likert-point' }, input, h('span', { text: String(v) }));
      input.addEventListener('change', () => {
        points.forEach((p) => p.classList.remove('selected'));
        point.classList.add('selected');
        answers[item.id] = v;
        hideError(errors[item.id]);
      });
      points.push(point);
      scale.append(point);
    }

    errors[item.id] = fieldError();

    return h('div', { class: 'likert-item' },
      h('p', { class: 'likert-statement', text: item.text }),
      scale,
      h('div', { class: 'likert-ends' },
        h('span', { text: `1 \u2014 ${LIKERT_MIN_LABEL}` }),
        h('span', { text: `7 \u2014 ${LIKERT_MAX_LABEL}` })
      ),
      errors[item.id]
    );
  });

  const formErr = fieldError();
  formErr.classList.add('form-error');
  const submit = h('button', { class: 'cta', text: 'Submit' });

  submit.addEventListener('click', async () => {
    hideError(formErr);
    const missing = QUESTIONNAIRE_ITEMS.filter((item) => !answers[item.id]);
    for (const item of missing) showError(errors[item.id], 'Please rate this statement.');

    if (missing.length) {
      showError(formErr, `Please answer all ${QUESTIONNAIRE_ITEMS.length} statements before submitting.`);
      app.querySelector('.error:not([hidden])')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    submit.disabled = true;
    submit.textContent = 'Submitting\u2026';
    try {
      await api('/api/submit', { answers });
      clearSession();
      renderDone();
    } catch {
      submit.disabled = false;
      submit.textContent = 'Submit';
      showError(formErr, MESSAGES.genericError);
    }
  });

  screen('questionnaire',
    h('div', { class: 'card' },
      h('h1', { text: 'A few final questions' }),
      h('p', { class: 'lede', text: 'Rate each statement from 1 (strongly disagree) to 7 (strongly agree). All are required.' }),
      items,
      submit,
      formErr
    )
  );
}

/* ---------------- terminal screens ---------------- */

function renderDone() {
  renderTerminal(MESSAGES.thanks, 'Your response has been recorded. You may now close this window.');

  /* Nothing should navigate back into a submitted study. Re-pushing the state on every
     popstate turns the back button into a no-op rather than letting a participant
     re-enter the questionnaire against a session that is already closed. */
  history.pushState({ done: true }, '');
  window.addEventListener('popstate', () => {
    history.pushState({ done: true }, '');
    renderTerminal(MESSAGES.thanks, 'Your response has been recorded. You may now close this window.');
  });
}

function renderTerminal(title, message) {
  stepEl.hidden = true;
  app.replaceChildren(
    h('div', { class: 'card' },
      h('div', { class: 'terminal' },
        h('h1', { text: title }),
        h('p', { text: message })
      )
    )
  );
  window.scrollTo(0, 0);
}

/* ---------------- boot and resume ----------------
 *
 * A stored id means an unfinished session, so the server is asked where it left off
 * rather than the client guessing from what it happens to remember. An id the server
 * does not recognise -- a cleaned-up abandoned session, or a different deployment --
 * is discarded and the visit is treated as new. */

async function boot() {
  sessionId = readSession();

  if (!sessionId) return renderConsent();

  let state;
  try {
    state = await api('/api/session/resume');
  } catch (err) {
    if (err.status === 404) {
      clearSession();
      sessionId = null;
      return renderConsent();
    }
    return renderTerminal(
      'We could not reach the study',
      'Please check your connection and reload the page.'
    );
  }

  switch (state.stage) {
    case 'onboarding':
      return renderOnboarding(state.onboarding || {});
    case 'calibration':
      return renderCalibration(state.calibration || {});
    case 'treatment':
      /* The assignment is reloaded, never regenerated: the same colour and the same
         customisation options the participant was originally given. */
      return state.treatment
        ? renderReveal(state.treatment)
        : renderReveal();
    case 'questionnaire':
      return renderQuestionnaire();
    case 'done':
      clearSession();
      return renderTerminal(MESSAGES.thanks, 'Your response has already been recorded. Thank you.');
    default:
      clearSession();
      sessionId = null;
      return renderConsent();
  }
}

boot();
