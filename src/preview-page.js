/* The preview picker, as a string the Worker can serve.
 *
 * It lives in src/ and not in public/ for the same reason it used to live in tools/:
 * public/ is uploaded to Cloudflare as static assets and served to anyone who asks,
 * with no gate in front of it. This is the one page in the project that names both
 * conditions and all three customisation levels out loud, so it must never be a file
 * that a URL alone can fetch. Kept here, it is bundled into the Worker and handed out
 * only by a route that has already checked a token.
 *
 * It is a template string rather than an imported .html file so that this holds true
 * without depending on bundler configuration to keep an asset out of the upload. */

import { COLOUR_POOL, colourKey } from '../public/shared/study-config.js';
import { translate } from '../public/shared/i18n.js';

/* The two colour menus are built from COLOUR_POOL rather than typed out, so they cannot
 * drift from the pool the preview route validates against: an option that is not in the
 * pool would be refused, and a hue added to the pool would be missing from the menu.
 *
 * Named in English regardless of the language chosen for the run. The picker is an
 * instrument for whoever is driving it, not part of the study, and someone checking the
 * Tamil rendering still needs to know which hue they just asked for. */
function colourOptions(selectedHex) {
  return COLOUR_POOL.map((colour) => {
    const name = translate('en', colourKey(colour));
    const selected = colour.hex.toLowerCase() === selectedHex.toLowerCase() ? ' selected' : '';
    return `        <option value="${colour.hex}" style="background:${colour.hex}"${selected}>`
      + `${name} (${colour.hex})</option>`;
  }).join('\n');
}

/* The hues the preview used before it could be asked for one: far enough apart that
 * which of the two the reveal names is obvious at a glance. */
export const PREVIEW_DEFAULT_LIKED = COLOUR_POOL[0].hex;
export const PREVIEW_DEFAULT_DISLIKED = COLOUR_POOL[5].hex;

export const previewPage = () => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Preview a cell</title>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<style>
  :root {
    --ink: #1B1A18;
    --ink-soft: #6B6862;
    --line: #E3E0D9;
    --bg: #F7F5F0;
    --accent: #1B1A18;
    --warn-bg: #FDF6E3;
    --warn-line: #C9A227;
    --error: #A63D3D;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 40px 20px 72px;
    background: var(--bg);
    color: var(--ink);
    font-family: Inter, system-ui, sans-serif;
    font-size: 14px;
    line-height: 1.55;
  }
  main { max-width: 760px; margin: 0 auto; }
  h1 { font-size: 20px; margin: 0 0 6px; font-weight: 600; }
  h2 { font-size: 13px; margin: 0 0 12px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-soft); }
  p { margin: 0 0 14px; color: var(--ink-soft); }

  .banner {
    background: var(--warn-bg);
    border-left: 3px solid var(--warn-line);
    padding: 12px 14px;
    margin: 0 0 28px;
    font-size: 13px;
    color: var(--ink);
  }
  .banner b { font-weight: 600; }
  .banner p { color: var(--ink); margin: 0 0 8px; }
  .banner p:last-child { margin: 0; }

  .card {
    background: #fff;
    border: 1px solid var(--line);
    border-radius: 3px;
    padding: 22px 24px;
    margin-bottom: 20px;
  }

  .row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: 18px; }
  label { font-size: 13px; font-weight: 500; }
  select {
    font-family: inherit;
    font-size: 13px;
    padding: 7px 10px;
    border: 1px solid var(--line);
    border-radius: 2px;
    background: #fff;
    color: var(--ink);
  }

  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 10px 8px; border-top: 1px solid var(--line); vertical-align: middle; }
  th { font-size: 11px; text-transform: uppercase; letter-spacing: .07em; color: var(--ink-soft); font-weight: 600; border-top: none; }
  td:first-child, th:first-child { padding-left: 0; }
  .level-name { font-weight: 500; }
  .level-note { color: var(--ink-soft); font-size: 12.5px; }

  button {
    font-family: inherit;
    font-size: 13px;
    font-weight: 600;
    padding: 9px 14px;
    border: none;
    border-radius: 2px;
    background: var(--accent);
    color: #fff;
    cursor: pointer;
    white-space: nowrap;
  }
  button:hover:not(:disabled) { opacity: .88; }
  button:disabled { opacity: .45; cursor: not-allowed; }
  button.ghost { background: transparent; color: var(--ink-soft); border: 1px solid var(--line); font-weight: 500; }

  .status { margin-top: 6px; font-size: 13px; min-height: 20px; }
  .status.error { color: var(--error); }
  code { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12px; background: var(--bg); padding: 1px 5px; border-radius: 2px; }
</style>
</head>
<body>
<main>
  <h1>Preview a cell</h1>
  <p>Jump straight into any of the twelve cells without waiting for randomisation to deal it to you.</p>

  <div class="banner">
    <p><b>This page is not for participants.</b> It names both conditions and all three
    customisation levels, which is exactly what the study keeps from the people taking
    it. Do not open it on a shared screen while the address bar or your history is
    visible, and do not leave it open in a browser someone else will use.</p>
    <p>Sessions started here are tagged as previews. They are excluded from the per-cell
    counts, from the admin export and from the CSV export, so you can walk a cell all
    the way through submission without consuming a slot or adding a row to your
    dataset.</p>
  </div>

  <div class="card">
    <h2>Participant details</h2>
    <div class="row">
      <label for="gender">Gender answer</label>
      <!-- These values must be exactly the strings in GENDER_OPTIONS; the model is
           derived from the answer, so a near-miss would quietly give you the default. -->
      <select id="gender">
        <option value="Female">Female</option>
        <option value="Male">Male</option>
        <option value="Prefer not to say">Prefer not to say</option>
      </select>
      <span class="level-note">Decides which model photograph is used, so it changes what you see rendered.</span>
    </div>
    <div class="row">
      <label for="generation">Generation</label>
      <select id="generation">
        <option value="GenZ">Gen Z</option>
        <option value="GenX">Gen X</option>
      </select>
      <span class="level-note">Recorded on the response; it does not change the screens.</span>
    </div>
    <div class="row" style="margin-bottom:0">
      <label for="language">Language</label>
      <!-- Worth stepping through a cell in each language rather than trusting the
           catalogue to be right. A translation can be accurate and still break the
           screen: the swatch lock badge and the three sleeve pills are the tightest
           places, and neither shows a problem until the words are actually in them. -->
      <select id="language">
        <option value="en">English</option>
        <option value="si">&#3523;&#3538;&#3458;&#3524;&#3517; (Sinhala)</option>
        <option value="ta">&#2980;&#2990;&#3007;&#2996;&#3021; (Tamil)</option>
      </select>
      <span class="level-note">The whole study renders in this, including the reveal sentence and the Stage 4 controls.</span>
    </div>
  </div>

  <div class="card">
    <h2>Colour choices</h2>
    <!-- Stands in for what the participant picks in Stage 3. Which of the two the
         garment ends up wearing is decided by the condition, not here: the Liked rows
         below use the most liked colour and the Disliked rows use the least liked one.
         So to show a particular colour on the shirt, set it as the most liked and open
         a Liked row. -->
    <p>What the participant would have chosen in the colour calibration. The condition
    then decides which of the two the T-shirt is rendered in.</p>
    <div class="row">
      <label for="liked-colour">Most liked</label>
      <select id="liked-colour">
${colourOptions(COLOUR_POOL[0].hex)}
      </select>
      <span class="level-note">Worn by the garment in the Liked rows.</span>
    </div>
    <div class="row" style="margin-bottom:0">
      <label for="disliked-colour">Least liked</label>
      <select id="disliked-colour">
${colourOptions(COLOUR_POOL[5].hex)}
      </select>
      <span class="level-note">Worn by the garment in the Disliked rows.</span>
    </div>
  </div>

  <div class="card">
    <h2>Liked condition</h2>
    <p style="margin-bottom:4px">The reveal names the colour they picked as their favourite.</p>
    <table><tbody id="liked"></tbody></table>
  </div>

  <div class="card">
    <h2>Disliked condition</h2>
    <p style="margin-bottom:4px">The reveal names the colour they picked as their least favourite.</p>
    <table><tbody id="disliked"></tbody></table>
  </div>

  <div class="card">
    <h2>Current session</h2>
    <p id="current" style="margin-bottom:14px"></p>
    <div class="row" style="margin-bottom:0">
      <button class="ghost" id="resume">Resume it at /</button>
      <button class="ghost" id="clear">Forget it and start clean</button>
    </div>
  </div>

  <div class="status" id="status"></div>
</main>

<script>
  const SESSION_KEY = 'chameleon.sessionId';

  const LEVELS = [
    { level: 1, name: 'Level 1 \\u2014 no customisation', note: 'Garment only. There should be no controls at all, and no Customise button.' },
    { level: 2, name: 'Level 2 \\u2014 text, sleeve, neck', note: 'Custom text with font size, ink colour and drag; sleeve length; neck style. No skin-tone slider.' },
    { level: 3, name: 'Level 3 \\u2014 adds skin tone', note: 'Everything in Level 2 plus the skin-tone slider.' }
  ];

  const statusEl = document.getElementById('status');
  const currentEl = document.getElementById('current');

  function setStatus(message, isError) {
    statusEl.textContent = message || '';
    statusEl.classList.toggle('error', Boolean(isError));
  }

  function readSession() {
    try { return localStorage.getItem(SESSION_KEY); } catch { return null; }
  }

  function showCurrent() {
    const id = readSession();
    currentEl.innerHTML = id
      ? 'A session is stored in this browser: <code>' + id + '</code>'
      : 'No session stored in this browser. Opening / would start at the consent screen.';
    document.getElementById('resume').disabled = !id;
    document.getElementById('clear').disabled = !id;
  }

  function buildRows(tbodyId, condition) {
    const tbody = document.getElementById(tbodyId);
    const header = document.createElement('tr');
    header.innerHTML = '<th>Customisation level</th><th>What to check</th><th></th>';
    tbody.append(header);

    for (const entry of LEVELS) {
      const tr = document.createElement('tr');

      const nameCell = document.createElement('td');
      nameCell.className = 'level-name';
      nameCell.textContent = entry.name;

      const noteCell = document.createElement('td');
      noteCell.className = 'level-note';
      noteCell.textContent = entry.note;

      const actionCell = document.createElement('td');
      const button = document.createElement('button');
      button.textContent = 'Open';
      button.addEventListener('click', () => launch(condition, entry.level, button));
      actionCell.append(button);

      tr.append(nameCell, noteCell, actionCell);
      tbody.append(tr);
    }
  }

  async function launch(condition, level, button) {
    const generation = document.getElementById('generation').value;
    const gender = document.getElementById('gender').value;
    const language = document.getElementById('language').value;
    const likedColourHex = document.getElementById('liked-colour').value;
    const dislikedColourHex = document.getElementById('disliked-colour').value;

    /* Caught here as well as on the server, because the server's refusal is a flat 400
       and this says which two menus to go and change. */
    if (likedColourHex === dislikedColourHex) {
      setStatus('The most liked and least liked colours have to be different.', true);
      return;
    }

    button.disabled = true;
    setStatus('Seeding a session\\u2026');

    try {
      /* Same-origin so the gate cookie rides along; the route rejects anything without
         it with a 404 rather than a 401, so an unauthorised caller cannot tell the
         endpoint apart from one that does not exist. */
      const res = await fetch('/api/dev/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          generation, condition, level, gender, language,
          likedColourHex, dislikedColourHex
        })
      });

      if (!res.ok) {
        const detail = await res.json().catch(() => ({}));
        setStatus(
          res.status === 404
            ? 'The preview route turned this down. The gate cookie has most likely expired \\u2014 open the unlock link again.'
            : 'Could not seed a session: ' + (detail.error || res.status),
          true
        );
        button.disabled = false;
        return;
      }

      const data = await res.json();
      try {
        localStorage.setItem(SESSION_KEY, data.sessionId);
      } catch {
        setStatus('This browser refused localStorage, so the study cannot pick the session up.', true);
        button.disabled = false;
        return;
      }
      location.href = '/';
    } catch (err) {
      setStatus('Could not reach the server: ' + err.message, true);
      button.disabled = false;
    }
  }

  document.getElementById('resume').addEventListener('click', () => { location.href = '/'; });
  document.getElementById('clear').addEventListener('click', () => {
    try { localStorage.removeItem(SESSION_KEY); } catch { /* nothing to remove */ }
    showCurrent();
    setStatus('Cleared. Opening / now starts at consent.');
  });

  buildRows('liked', 'Liked');
  buildRows('disliked', 'Disliked');
  showCurrent();
</script>
</body>
</html>
`;
