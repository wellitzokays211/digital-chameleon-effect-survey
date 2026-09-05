/* Participant flow controller.
 *
 * Owns the session, the stage machine and every screen except the Stage 4 controls,
 * which are the Worker's job. Nothing in this file knows the participant's condition
 * or customisation level: the server hands over a finished reveal sentence and a
 * yes/no on whether customisation is available, and that is all the client is told.
 * Reading this file end to end tells a curious participant nothing about the design.
 *
 * No participant-facing wording lives here either. Every string is a key into
 * public/shared/strings/, so the flow reads the same in all three languages and a
 * translator never has to open this file. */

import {
  COLOUR_POOL,
  colourByHex,
  colourKey,
  isEligibleBirthYear,
  birthYearRangesText,
  GENDER_OPTIONS,
  EX1_VALUES,
  EX2_VALUES,
  QUESTIONNAIRE_ITEM_IDS,
  LIKERT_MIN,
  LIKERT_MAX,
  STEP_NUMBERS,
  TOTAL_STEPS,
  LOADING_FLOOR_MS
} from './shared/study-config.js';
import { LANGUAGES, LANGUAGE_FIELD_LABEL, normaliseLanguage } from './shared/languages.js';
import { t, setLanguage, getLanguage } from './shared/i18n.js';

const SESSION_KEY = 'chameleon.sessionId';
const LANGUAGE_KEY = 'chameleon.language';

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

/* The language is remembered separately from the session and outlives it.
 *
 * It is chosen on the consent screen, before there is a session to attach it to, and a
 * participant who reloads that screen must not be dropped back into English. Once the
 * session exists the server's copy is authoritative -- see boot() -- because that is
 * the one that survives a different device. */
function readStoredLanguage() {
  try { return localStorage.getItem(LANGUAGE_KEY); } catch { return null; }
}
function writeStoredLanguage(code) {
  try { localStorage.setItem(LANGUAGE_KEY, code); } catch { /* choice not remembered */ }
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
  const number = STEP_NUMBERS[stage];
  stepEl.textContent = number
    ? t('step.format', { current: number, total: TOTAL_STEPS })
    : '';
  stepEl.hidden = !number;
  window.scrollTo(0, 0);
}

/* ---------------- reusable inputs ---------------- */

function radioGroup({ name, options, value, onChange }) {
  const group = h('div', { class: 'options', role: 'radiogroup' });
  for (const opt of options) {
    const input = h('input', {
      type: 'radio',
      name,
      value: String(opt.value),
      checked: String(value) === String(opt.value)
    });
    const row = h('label', { class: 'option' + (String(value) === String(opt.value) ? ' selected' : '') },
      input,
      h('span', { class: 'option-text', text: opt.label })
    );
    input.addEventListener('change', () => {
      group.querySelectorAll('.option').forEach((n) => n.classList.remove('selected'));
      row.classList.add('selected');
      onChange(opt.value);
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

/* ---------------- Stage 1: consent ----------------
 *
 * The only screen with the language picker on it, and the last moment it can appear.
 * Once the consent button is pressed the session exists and the language is written to
 * it, and from then on a participant switching language mid-study would be answering
 * one wording of the scale having read another. */

function renderConsent(state) {
  const agreed = { value: Boolean(state?.agreed) };
  const err = fieldError();

  const checkbox = h('input', { type: 'checkbox', checked: agreed.value });
  const proceed = h('button', {
    class: 'cta',
    disabled: !agreed.value,
    text: t('consent.agree')
  });

  checkbox.addEventListener('change', () => {
    agreed.value = checkbox.checked;
    proceed.disabled = !checkbox.checked;
    if (checkbox.checked) hideError(err);
  });

  proceed.addEventListener('click', async () => {
    if (!agreed.value) return showError(err, t('consent.confirmRequired'));
    proceed.disabled = true;
    proceed.textContent = t('common.starting');
    try {
      /* The language goes with the request that creates the session, not a later
         update, so there is no window in which a response document exists without one. */
      const { sessionId: id } = await api('/api/session/start', { language: getLanguage() });
      sessionId = id;
      writeSession(id);
      renderOnboarding({});
    } catch {
      proceed.disabled = false;
      proceed.textContent = t('consent.agree');
      showError(err, t('message.genericError'));
    }
  });

  screen('consent',
    h('div', { class: 'card' },
      /* The whole box, not its value. The redraw happens whenever the participant
         changes language, which may be long after this line ran, and passing the
         boolean would carry the state as it was at first paint -- losing a tick made in
         between and quietly re-arming the "please confirm" error. */
      languageField(agreed),
      h('h1', { text: t('consent.title') }),
      /* The button is named inside the sentence by interpolation rather than quoted, so
         a translation cannot end up telling the participant to press something whose
         label was rendered differently three lines below. */
      h('p', {
        class: 'consent-body',
        text: t('consent.body', { agreeButton: t('consent.agree') })
      }),
      h('label', { class: 'checkbox-row' },
        checkbox,
        h('span', { text: t('consent.checkbox') })
      ),
      proceed,
      err,
      /* Declining writes nothing: no session is started until the button above is
         clicked, so there is no record to remove. */
      h('button', {
        class: 'cta secondary',
        text: t('consent.decline'),
        onclick: () => renderTerminal(t('common.thankYou'), t('message.declined'))
      })
    )
  );
}

/* A native <select> rather than a custom widget.
 *
 * It inherits the platform's own language picker behaviour on a phone, is reachable by
 * keyboard and screen reader without any work, and cannot be left half-styled in a
 * script the developer cannot read. The options are named in their own scripts, since
 * a participant who needs this control cannot read the English word for their own
 * language -- see public/shared/languages.js. */
function languageField(agreed) {
  const select = h('select', { class: 'language-select', id: 'language' });

  for (const language of LANGUAGES) {
    select.append(h('option', {
      value: language.code,
      selected: language.code === getLanguage(),
      text: language.code === 'en' ? language.endonym : `${language.endonym} (${language.label})`
    }));
  }

  select.addEventListener('change', () => {
    const code = setLanguage(select.value);
    writeStoredLanguage(code);
    /* Redrawn rather than patched in place. Every string on the screen changes, and the
       consent checkbox is carried across so a participant who ticks the box and then
       switches language does not silently lose it. */
    renderConsent({ agreed: agreed.value });
  });

  return h('div', { class: 'language-field' },
    h('label', { class: 'language-label', for: 'language', text: LANGUAGE_FIELD_LABEL }),
    select
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

  const ineligibleMessage = () =>
    t('onboarding.ineligible', { ranges: birthYearRangesText(t('common.rangeJoin')) });

  const yearInput = h('input', {
    type: 'number',
    class: 'text-input',
    inputmode: 'numeric',
    placeholder: t('onboarding.birthYearPlaceholder'),
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
    placeholder: t('onboarding.emailPlaceholder'),
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

  const submit = h('button', { class: 'cta', text: t('common.continue') });

  submit.addEventListener('click', async () => {
    hideError(formErr);
    let ok = true;

    if (!data.birthYear) {
      showError(yearErr, t('onboarding.birthYearRequired'));
      yearInput.setAttribute('aria-invalid', 'true');
      ok = false;
    } else if (!/^\d{4}$/.test(data.birthYear)) {
      showError(yearErr, t('onboarding.birthYearFourDigits'));
      yearInput.setAttribute('aria-invalid', 'true');
      ok = false;
    } else if (!isEligibleBirthYear(data.birthYear)) {
      showError(yearErr, ineligibleMessage());
      yearInput.setAttribute('aria-invalid', 'true');
      ok = false;
    }

    if (!data.gender) { showError(genderErr, t('common.selectOption')); ok = false; }

    if (!data.email) {
      showError(emailErr, t('onboarding.emailRequired'));
      emailInput.setAttribute('aria-invalid', 'true');
      ok = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) {
      showError(emailErr, t('onboarding.emailInvalid'));
      emailInput.setAttribute('aria-invalid', 'true');
      ok = false;
    }

    if (!data.ex1) { showError(ex1Err, t('common.selectOption')); ok = false; }
    if (!data.ex2) { showError(ex2Err, t('common.selectOption')); ok = false; }

    if (!ok) {
      app.querySelector('.error:not([hidden])')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    submit.disabled = true;
    submit.textContent = t('common.saving');
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
        return renderTerminal(t('common.thankYou'), t('message.duplicate'));
      }
      if (res.ineligible) {
        submit.disabled = false;
        submit.textContent = t('common.continue');
        return showError(yearErr, ineligibleMessage());
      }
      renderCalibration({});
    } catch {
      submit.disabled = false;
      submit.textContent = t('common.continue');
      showError(formErr, t('message.genericError'));
    }
  });

  screen('onboarding',
    h('div', { class: 'card' },
      h('h1', { text: t('onboarding.title') }),
      h('p', { class: 'lede', text: t('onboarding.lede') }),

      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: t('onboarding.birthYear') }),
        yearInput,
        yearErr
      ),

      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: t('onboarding.gender') }),
        radioGroup({
          name: 'gender',
          /* The value stored is the English token; only the label is translated. */
          options: GENDER_OPTIONS.map((value) => ({ value, label: t(`gender.${value}`) })),
          value: data.gender,
          onChange: (v) => { data.gender = v; hideError(genderErr); }
        }),
        genderErr
      ),

      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: t('onboarding.email') }),
        h('p', { class: 'field-hint', text: t('onboarding.emailHint') }),
        emailInput,
        emailErr
      ),

      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: t('onboarding.ex1') }),
        radioGroup({
          name: 'ex1',
          options: EX1_VALUES.map((value) => ({ value, label: t(`ex1.${value}`) })),
          value: data.ex1,
          onChange: (v) => { data.ex1 = v; hideError(ex1Err); }
        }),
        ex1Err
      ),

      h('div', { class: 'field' },
        h('label', { class: 'field-label', text: t('onboarding.ex2') }),
        radioGroup({
          name: 'ex2',
          options: EX2_VALUES.map((value) => ({ value, label: t(`ex2.${value}`) })),
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

/* ---------------- Stage 3: calibration ----------------
 *
 * Five screens, not two: an announcement, the first palette, a second announcement, the
 * second palette, then both choices shown together.
 *
 * The three extra screens are not decoration. The two palettes are necessarily
 * near-identical -- the same ten swatches in the same grid, because holding the layout
 * constant is what keeps the second choice comparable to the first -- and a participant
 * who read one prompt and not the other took the second screen for the first screen
 * redisplayed by mistake. At least one told us so. The failure is silent in the data:
 * they answer the same question twice, both hexes are populated, and nothing marks the
 * response as suspect.
 *
 * So each palette is now preceded by a screen that does nothing except say which of the
 * two choices is coming, and followed at the end by one that shows what was recorded.
 * The announcements wait for a click rather than timing out, because a screen that
 * disappears on its own can be missed by exactly the participant who was not reading
 * carefully -- which is the participant this exists for. */

function renderCalibration(prefill) {
  let liked = prefill.likedColourHex ?? null;
  let disliked = null;

  /* Deliberately plain: a heading, at most one line under it, and a button. Anything
     else on the screen would give the eye somewhere else to go. */
  function announce({ title, body, onContinue }) {
    screen('calibration',
      h('div', { class: 'card centred announce' },
        h('h1', { text: title }),
        body ? h('p', { class: 'lede', text: body }) : null,
        h('button', { class: 'cta', text: t('common.continue'), onclick: onContinue })
      )
    );
  }

  /* Tapping a swatch locks it and stamps the badge across it, so the participant can see
     at a glance which colour they have committed to rather than inferring it from a thin
     border. The lock still moves if they tap elsewhere, and only Continue commits it: a
     mis-tap must not silently decide the colour the rest of the study hangs on.

     Both the subheading and the badge name which of the two choices is being made. The
     two screens are otherwise near-identical -- same heading, same grid, same layout --
     so without that, a participant who glanced past the prompt could give their most
     liked colour twice and never notice. That mistake is invisible in the data: the two
     hexes are simply wrong, not missing. */
  function pool({ subtitle, prompt, spent, spentRole, lockLabel, initial, onConfirm }) {
    let chosen = initial || null;
    const buttons = new Map();
    const grid = h('div', { class: 'swatch-pool' });

    for (const colour of COLOUR_POOL) {
      const isSpent = spent?.hex === colour.hex;
      const name = t(colourKey(colour));
      const btn = h('button', {
        type: 'button',
        class: 'pool-swatch',
        style: `background:${colour.hex}`,
        title: isSpent
          ? t('calibration.swatchLockedTitle', { colour: name, role: spentRole })
          : name,
        'aria-label': isSpent
          ? t('calibration.swatchLockedAria', { colour: name, role: spentRole })
          : name,
        disabled: isSpent
      });
      if (!isSpent) {
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', () => { chosen = colour; hideError(err); paint(); });
      }
      buttons.set(colour.hex, btn);
      grid.append(btn);
    }

    const cta = h('button', { class: 'cta', text: t('common.continue'), disabled: true });
    const err = fieldError();
    err.classList.add('form-error');

    function paint() {
      for (const [hex, btn] of buttons) {
        const isChosen = chosen?.hex === hex;
        /* A spent colour is disabled, so it can never also be the chosen one. */
        const role = isChosen
          ? lockLabel
          : spent?.hex === hex
            ? t('calibration.mostLiked')
            : null;
        btn.classList.toggle('locked', Boolean(role));
        if (!btn.disabled) btn.setAttribute('aria-pressed', String(isChosen));
        /* The newline is deliberate, and rendered with white-space: pre-line. The first
           line states what happened; the line under it states which of the two choices
           this is, and stacking them keeps both legible inside a swatch. */
        btn.replaceChildren(
          ...(role
            ? [h('span', { class: 'swatch-lock' },
                h('span', { text: `${t('calibration.locked')}\n${role}` }))]
            : [])
        );
      }
      cta.disabled = !chosen;
    }

    cta.addEventListener('click', () => {
      if (chosen) onConfirm(chosen, cta, err);
    });
    paint();

    return h('div', { class: 'card' },
      h('h1', { text: t('calibration.title') }),
      h('h2', { text: subtitle }),
      h('p', { class: 'lede', text: prompt }),
      grid,
      h('p', { class: 'hint', text: t('calibration.hint') }),
      cta,
      err
    );
  }

  function introLiked() {
    announce({ title: t('calibration.introLikedTitle'), onContinue: askLiked });
  }

  function askLiked() {
    screen('calibration', pool({
      subtitle: t('calibration.likedSubtitle'),
      prompt: t('calibration.likedPrompt'),
      spent: null,
      spentRole: null,
      lockLabel: t('calibration.mostLiked'),
      initial: colourByHex(liked),
      onConfirm: (colour) => { liked = colour.hex; introDisliked(); }
    }));
  }

  /* Confirms the first choice before naming the second, so the participant crosses a
     screen that says the two are different things before meeting the identical grid. */
  function introDisliked() {
    announce({
      title: t('calibration.introDislikedTitle'),
      body: t('calibration.introDislikedBody'),
      onContinue: askDisliked
    });
  }

  /* The liked swatch stays in the grid, locked, rather than being removed: the grid does
     not reflow and the second choice is made against the same spatial layout as the first. */
  function askDisliked() {
    screen('calibration', pool({
      subtitle: t('calibration.dislikedSubtitle'),
      prompt: t('calibration.dislikedPrompt'),
      spent: colourByHex(liked),
      spentRole: t('calibration.mostLikedInline'),
      lockLabel: t('calibration.leastLiked'),
      initial: null,
      /* Saved here rather than after the summary. The summary is a confirmation of what
         was recorded, so the recording has to have happened by the time it is shown; and
         a participant who closes the tab while reading it must not lose two choices they
         already made. The consequence is that resuming from the summary screen lands on
         the reveal instead, which is the right trade. */
      onConfirm: async (colour, cta, err) => {
        cta.disabled = true;
        try {
          await api('/api/calibration', { likedColourHex: liked, dislikedColourHex: colour.hex });
          disliked = colour.hex;
          showBothColours();
        } catch {
          cta.disabled = false;
          showError(err, t('message.genericError'));
        }
      }
    }));
  }

  /* Both choices, side by side and named.
   *
   * This is what actually answers the participant who thought they had been asked the
   * same question twice: two different colours, labelled with the two different roles,
   * on one screen. The names are spelled out as well as shown, which also means the
   * screen still works for a participant who cannot distinguish the two swatches.
   *
   * The note underneath says one of the two will be chosen at random. That is a
   * disclosure about the design rather than interface copy: it is accurate, it stops a
   * participant in the disliked condition reading their reveal as another error, and it
   * tells everyone the colour was not theirs to choose. It says nothing about which of
   * the two conditions this participant is in, and the blinding is unaffected. */
  function showBothColours() {
    const likedColour = colourByHex(liked);
    const dislikedColour = colourByHex(disliked);

    screen('calibration',
      h('div', { class: 'card centred' },
        h('h1', { text: t('calibration.summaryTitle') }),
        h('div', { class: 'colour-summary' },
          summaryTile(likedColour, t('calibration.mostLiked')),
          summaryTile(dislikedColour, t('calibration.leastLiked'))
        ),
        h('p', { class: 'hint summary-note', text: t('calibration.summaryNote') }),
        h('button', { class: 'cta', text: t('common.continue'), onclick: () => renderReveal() })
      )
    );
  }

  function summaryTile(colour, role) {
    const name = t(colourKey(colour));
    return h('div', { class: 'summary-colour' },
      /* The name below carries the same information, so the swatch is decorative to a
         screen reader rather than something it should try to describe. */
      h('div', { class: 'summary-swatch', style: `background:${colour.hex}`, 'aria-hidden': 'true' }),
      h('span', { class: 'summary-role', text: role }),
      h('span', { class: 'summary-name', text: name })
    );
  }

  introLiked();
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
        h('div', { class: 'spinner', role: 'status', 'aria-label': t('reveal.preparingAria') }),
        h('p', { text: t('reveal.preparing') })
      )
    )
  );

  const floor = new Promise((resolve) => setTimeout(resolve, LOADING_FLOOR_MS));

  (async () => {
    try {
      const assignment = existing || await api('/api/assign');
      if (assignment.studyFull) {
        await floor;
        return renderTerminal(t('common.thankYou'), t('message.studyFull'));
      }

      const host = await loadStage4Module();
      preparedGarment = await host.prepare(assignment);

      await floor;
      showReveal(assignment);
    } catch (err) {
      await floor;
      const retry = h('button', {
        class: 'cta',
        text: t('common.tryAgain'),
        onclick: () => renderReveal(existing)
      });
      screen('reveal',
        h('div', { class: 'card centred' },
          h('h1', { text: t('reveal.failedTitle') }),
          h('p', { class: 'lede', text: t('message.genericError') }),
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
      /* Already in the participant's language: the server composed it, because which of
         the two endings it carries is the manipulation and must not be inferable here. */
      h('p', { class: 'reveal-sentence', text: assignment.revealSentence }),
      h('button', {
        class: 'cta',
        text: t('common.continue'),
        onclick: () => renderTreatment(assignment)
      })
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
        done(t('message.genericError'));
      }
    }
  });
}

/* ---------------- Stage 5: questionnaire ---------------- */

function renderQuestionnaire() {
  const answers = {};
  const errors = {};

  const items = QUESTIONNAIRE_ITEM_IDS.map((id) => {
    const statement = t(`item.${id}`);
    const scale = h('div', { class: 'likert-scale', role: 'radiogroup', 'aria-label': statement });
    const points = [];

    for (let v = LIKERT_MIN; v <= LIKERT_MAX; v++) {
      const input = h('input', { type: 'radio', name: id, value: String(v) });
      const point = h('label', { class: 'likert-point' }, input, h('span', { text: String(v) }));
      input.addEventListener('change', () => {
        points.forEach((p) => p.classList.remove('selected'));
        point.classList.add('selected');
        answers[id] = v;
        hideError(errors[id]);
      });
      points.push(point);
      scale.append(point);
    }

    errors[id] = fieldError();

    return h('div', { class: 'likert-item' },
      h('p', { class: 'likert-statement', text: statement }),
      scale,
      h('div', { class: 'likert-ends' },
        h('span', { text: `${LIKERT_MIN} \u2014 ${t('questionnaire.likertMin')}` }),
        h('span', { text: `${LIKERT_MAX} \u2014 ${t('questionnaire.likertMax')}` })
      ),
      errors[id]
    );
  });

  const formErr = fieldError();
  formErr.classList.add('form-error');
  const submit = h('button', { class: 'cta', text: t('common.submit') });

  submit.addEventListener('click', async () => {
    hideError(formErr);
    const missing = QUESTIONNAIRE_ITEM_IDS.filter((id) => !answers[id]);
    for (const id of missing) showError(errors[id], t('questionnaire.rateRequired'));

    if (missing.length) {
      showError(formErr, t('questionnaire.allRequired', { count: QUESTIONNAIRE_ITEM_IDS.length }));
      app.querySelector('.error:not([hidden])')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      return;
    }

    submit.disabled = true;
    submit.textContent = t('common.submitting');
    try {
      await api('/api/submit', { answers });
      clearSession();
      renderDone();
    } catch {
      submit.disabled = false;
      submit.textContent = t('common.submit');
      showError(formErr, t('message.genericError'));
    }
  });

  screen('questionnaire',
    h('div', { class: 'card' },
      h('h1', { text: t('questionnaire.title') }),
      h('p', { class: 'lede', text: t('questionnaire.lede') }),
      items,
      submit,
      formErr
    )
  );
}

/* ---------------- terminal screens ---------------- */

function renderDone() {
  renderTerminal(t('message.thanks'), t('terminal.recorded'));

  /* Nothing should navigate back into a submitted study. Re-pushing the state on every
     popstate turns the back button into a no-op rather than letting a participant
     re-enter the questionnaire against a session that is already closed. */
  history.pushState({ done: true }, '');
  window.addEventListener('popstate', () => {
    history.pushState({ done: true }, '');
    renderTerminal(t('message.thanks'), t('terminal.recorded'));
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

  /* Applied before anything is drawn, so no screen flashes in English first. Only the
     locally remembered choice is available this early; a session's own language
     arrives with the resume below and wins, because that is the record of what the
     participant actually consented in. */
  setLanguage(normaliseLanguage(readStoredLanguage()));

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
    return renderTerminal(t('terminal.unreachableTitle'), t('terminal.unreachableBody'));
  }

  if (state.language) {
    setLanguage(state.language);
    writeStoredLanguage(state.language);
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
      return renderTerminal(t('message.thanks'), t('terminal.alreadyRecorded'));
    default:
      clearSession();
      sessionId = null;
      return renderConsent();
  }
}

boot();
