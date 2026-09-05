# Digital Chameleon Effect — Experimental Platform

A web-based research instrument for a BSc (Hons) dissertation at the University of
Kelaniya. Participants pass through five stages, are randomly assigned to one of twelve
experimental cells, stay blind to every condition but their own, and have each stage
written to the database as they complete it.

This is a research instrument, not a retail product. Where polish and correctness
compete, correctness wins.

---

## Running it locally

You need Node 20 or newer. Nothing else — no database, no Cloudflare account, no
administrator rights.

```bash
npm install
npm run extract-assets     # one-off: unpacks the prototype's images
npm run dev                # http://127.0.0.1:8787
```

In a second terminal, run the checks:

```bash
npm run check              # logic only
npm run check:live         # logic + the whole participant journey over HTTP
```

`npm run dev` uses a plain-Node server with in-memory storage, so state disappears when
you stop it. That is deliberate: it means the entire study, including randomisation and
resume, can be walked through before any infrastructure exists.

### Previewing a particular cell

Assignment is random with no override, which is right for running the study and awkward
for checking it: seeing all three customisation levels by chance means restarting until
randomisation happens to deal them out. So the dev server also serves a picker at
**http://127.0.0.1:8787/preview**. Choose a generation, condition and level and it seeds
a session that is already consented, onboarded and calibrated, then hands you to the
study, which resumes it at the reveal. Press Continue and you are in Stage 4 with the
controls for the level you asked for.

Two things make this safe to have in the repository:

- **The route does not exist in production.** It is added to the table only when the host
  passes `preview: true` to `createRouter`. `tools/dev-server.mjs` does; `src/index.js`
  does not. On the deployed Worker there is no such path to call, so no request, token or
  header can reach it. A check asserts both halves of that, and a third asserts that
  `src/index.js` never turns it on.
- **The picker is not in `public/`.** It lives in `tools/`, which is not uploaded as a
  static asset, because it is the one page that names the conditions and levels out loud.
  A check asserts that nothing under `public/` so much as mentions the endpoint.

Preview sessions are `completed: false` like any other, so they consume no capacity —
unless you submit the questionnaire, which is what marks a response complete. On the dev
server that is stored in memory and vanishes on restart either way.

Once you have a Cloudflare account you can also run the real Workers runtime with
`npm run dev:workers`, which additionally needs the Microsoft Visual C++
Redistributable installed.

---

## How it is put together

```
public/                      served to the browser
  index.html                 shell; every screen is built by app.js
  app.js                     stage machine, session, resume, validation
  styles.css
  shared/study-config.js     client-safe config — deliberately no design details
  shared/colour.js           HSL to hex, shared so colours cannot drift
  shared/languages.js        the three languages; one definition of what is valid
  shared/i18n.js             lookup, English fallback, coverage reporting
  shared/strings/{en,si,ta}.js   copy for every screen, one file per language
  renderer/tshirt-renderer.js  the prototype's rendering engine, as a module
  stage4/host.js             garment view; executes whatever controls it is sent
  assets/combos/             12 garments + masks, extracted from the prototype

src/                         the Worker — never served
  index.js                   Cloudflare entry point
  router.js                  routes, shared with the Node dev server
  study-service.js           every rule that matters to the experiment
  study-design.js            conditions, levels, cell map, targets
  strings-server.js          copy that would leak the design if it were served
  stage4-controls.js         the four controls; bundled per level
  stores.js                  MongoDB, Durable Object storage, in-memory
  data.js                    Durable Object holding the Mongo connection
  randomise.js               cell-count-aware allocation
  engagement.js              engagement flags and index
  hash.js                    salted SHA-256 of the email

tools/
  extract-assets.mjs         prototype -> cacheable image files
  dev-server.mjs             plain-Node server, no Workers runtime needed
  self-check.mjs             338 automated checks
  export-strings.mjs         all copy in all three languages, as a review CSV
  preview.html               dev-only cell picker, deliberately outside public/

prototype/                   the original file, kept for provenance. Never deployed.
```

The same `router.js` and `study-service.js` run in production and in development. Only
storage and hosting differ, so what you test locally is the real request handling and
the real experimental logic.

---

## The two things most easily got wrong

### Blinding

A Level 1 or Level 2 participant must have no way to discover that higher levels exist.
That is enforced structurally rather than by remembering to hide things:

- **The design never reaches the browser.** `public/shared/study-config.js` contains no
  condition names, no level numbers, no cell map and no targets. All of that is in
  `src/study-design.js`, which is bundled into the Worker and never served.
- **The client is not told its cell.** `/api/assign` returns a *finished* reveal
  sentence, the locked colour, and `customisation: { enabled: true|false }`. It never
  returns a level or a condition. A test asserts this by scanning the response for
  forbidden terms.
- **Controls are built per session on the server.** `/api/stage4/controls` reads the
  level from the session and returns only that level's control code. Nothing the
  browser sends influences the reply, because the browser never names a level — only
  its own session. Requests without a session, with an unknown session, or from a
  session that has not been assigned yet are refused.
- **No enumerable URL.** The bundle is fetched with the session id in a header, not
  loaded as a `<script src>`, so there is no guessable address whose contents vary.
- **The words are split the same way as the code.** `src/strings-server.js` holds both
  reveal clauses, the per-level changes list and every control label; the browser gets
  only what its own session is entitled to. This matters more than it sounds: once the
  interface is translated, "the Level 2 bundle does not contain the words *Model tone*"
  proves nothing about a Tamil participant, so the check is that the `skinTone` group is
  absent whatever language it would have been written in.
- **The one route that could bypass all of this does not exist in production.** The cell
  preview is registered only when the host asks for it, and only the dev server asks. See
  "Previewing a particular cell" above.

**One honest limit.** The rendering engine ships to everyone, because everyone needs
the garment drawn, and it necessarily contains the skin-tone maths. A determined Level 2
participant who read several hundred lines of image processing could infer that
recolouring skin is possible. What they cannot obtain is the control: it is never in
their DOM, never in their JavaScript, and the endpoint refuses their session.

### Only completed responses count

One document is created per session when consent is given, and updated as each stage
finishes — that is what makes resume possible. But `completed` is set `true` in exactly
one place, at Stage 5 submission. Every count, every cell cap and every export filters
on it, so an abandoned session sits in the database costing nothing and holding no slot.

Once a session has been assigned a cell, **that assignment is permanent**. Resume
reloads it and never re-randomises. A participant who closes the browser mid-task and
returns sees the same colour and the same options.

---

## Randomisation

Generation is fixed by birth year (Gen X 1965–1980, Gen Z 1997–2008) and never
randomised. Condition and level are assigned on entering Stage 3.5.

The draw is **cell-count-aware**: cells that have reached 20 completed responses are
withdrawn, and the choice is uniform over whichever of that generation's six cells
remain open. When every cell for a generation is full the participant sees the
"no longer accepting responses" screen instead of the task.

Three details worth knowing for the methods section:

- **Participants are told the draw happens.** The screen closing Stage 3 shows both
  chosen colours and says one of them will be randomly chosen for their T-shirt. This
  was added after a respondent reported the two colour screens as a duplicate-question
  bug, and it does more than clarify: disclosing randomisation is ethically cleaner, and
  it stops a disliked-condition participant reading their reveal as another error. But
  it also tells every participant the colour was not theirs to choose, which is read
  immediately before the ownership and perceived-agency items, and it may soften how
  aggrieved a disliked-condition participant feels about the outcome. That is a change
  to the liked-versus-disliked contrast, not just to the interface. Report it, and treat
  it as a limitation if the manipulation comes out weaker than the literature.
- The draw uses the platform CSPRNG with modulo-bias rejection, not `Math.random`.
  A test runs 12,000 draws and asserts uniformity within 15%.
- Allocation is **atomic in production**. Reading the counts and writing the chosen cell
  happen inside a single Durable Object, which processes one request at a time, so two
  simultaneous participants cannot both take the last slot. The Node dev server does not
  reproduce this, which is fine for a walkthrough.

| | Liked | Disliked |
|---|---|---|
| Gen X, Level 1 | 1 | 4 |
| Gen X, Level 2 | 2 | 5 |
| Gen X, Level 3 | 3 | 6 |
| Gen Z, Level 1 | 7 | 10 |
| Gen Z, Level 2 | 8 | 11 |
| Gen Z, Level 3 | 9 | 12 |

---

## Languages

The study runs in English, Sinhala and Tamil. English is the default, and the picker is
on the consent screen — deliberately the last screen where it can appear, because once
consent is given the language is written to the session and fixed. A participant who
could switch mid-study would be answering one wording of the scale having read another.

The choice is stored on the response, restored on resume (so returning on a second
device does not silently switch to English), and exported as a `language` column.

**The Sinhala and Tamil currently in the repository were produced by an AI assistant and
have not been verified by a native speaker.** They are good enough to build and test
against and are not good enough to collect data with. To get them reviewed:

```bash
npm run strings        # writes exports/translations-for-review.csv
```

That is every string in all three languages side by side, with an empty column to
correct each one in and a priority marking the rows where a plausible-looking
translation still changes the study. Paste corrections back into
`public/shared/strings/si.js`, `ta.js` and `src/strings-server.js`, then `npm run check`.

Four things about this are methodological rather than technical, and belong in the
write-up:

- **The eight scale items are a translated instrument.** Purchase intention,
  psychological ownership, perceived agency and colour preference. A translated
  validated scale is not automatically equivalent to the original; if one language reads
  stronger than another, language is confounded with condition and level. These need
  forward and back translation, not proofreading.
- **The consent body is an ethics document.** If the committee approved an English form,
  the translated forms may need approving too.
- **Colour names carry the manipulation.** Ten hues at one saturation and one lightness
  differ only by name, and the reveal names one of them back to the participant. Sinhala
  and Tamil have no everyday word for teal and normally borrow magenta, so those are
  built as compounds. A check enforces that all ten stay distinct in every language,
  because two collapsing onto one word would describe two treatments identically.
- **Nothing balances language across the twelve cells.** Randomisation is
  cell-count-aware over condition and level only, so language is free to correlate with
  generation. Worth crosstabbing before treating it as noise.

Coverage is enforced rather than hoped for: `npm run check` fails on a missing key, a
stale key, a scale item still in English, a lost `{placeholder}`, or a colour-name
collision.

---

## Data

Two collections, so identifying information and experimental data are never joined.

**`participants`** — `{ _id, emailHash, createdAt }`

Nothing else. No session id, no link of any kind to a response. The address is stored
as a salted SHA-256 digest; the plaintext is hashed in the request layer and never
travels further in. The salt is a secret pepper rather than a per-record salt, because
duplicate control has to be able to look an address up. **It must not be changed during
data collection** — every stored digest would become unmatchable and duplicate
detection would silently stop working.

**`responses`** — the experimental data, carrying no email and no identifier.

```
sessionId, language, birthYear, generation, gender, ex1, ex2,
likedColourHex, dislikedColourHex,
assignedCondition, assignedLevel, cellId,
stage4CompletionSeconds, flaggedFast,
customisation: { ...values for the assigned level..., engagement flags, engagementIndex },
pin1..pin3, po1..po3, pa1, cp1,
startedAt, submittedAt, lastUpdatedAt, completed
```

`language` is `en`, `si` or `ta`, written when the session is created and never changed
after. It is empty on any response collected before the picker existed.

Because the two collections share no key, deleting the email hashes at the close of data
collection leaves the experimental data completely intact:

```bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://your-worker.workers.dev/api/admin/delete-participants
```

### Engagement

Five booleans and a derived index distinguish participants who used their controls from
those who left everything at default. Each is a single before/after comparison at
submission — no keystroke or timestamp tracking.

Maxima are **3 at Level 2** (`textEdited`, `sleeveChanged`, `neckChanged`) and **4 at
Level 3** (those plus `skinToneAdjusted`), always **0 at Level 1**. The brief specified
four and five, including a `graphicSelected` flag for a graphic/icon picker; the
prototype has no such control and one was not added, so that flag could never be true
and is omitted rather than stored as a permanent `false` that would depress the index.

`skinToneAdjusted` is the one flag not decided by comparing values. Its default is
derived from each photograph's own average skin lightness rather than being a constant,
and a participant can drag the slider away and back and land on the default having very
much engaged — so the renderer reports whether the control was ever touched.

Only the fields belonging to the assigned level are stored. A Level 2 record has no
skin-tone value at all, because there was no skin-tone control to produce one.

---

## Admin

All endpoints need `Authorization: Bearer $ADMIN_TOKEN` and compare the token in
constant time.

| | |
|---|---|
| `GET /api/admin/counts` | per-cell completed counts and how many remain |
| `GET /api/admin/export` | every completed response, no identifiers |
| `GET /api/admin/health` | which storage backend is live |
| `POST /api/admin/cleanup` | delete incomplete sessions older than `olderThanDays` (default 30) |
| `POST /api/admin/delete-participants` | delete all email hashes, leaving responses untouched |

Cleanup only ever touches documents with `completed: false`; a test asserts that
completed counts are unchanged by it.

---

## Decisions taken against the brief

Six points where the brief and the prototype disagreed, resolved as agreed:

1. **No graphic/icon picker.** The prototype has none, and one was not built. Text is
   the whole content control; the engagement maxima drop to 3 and 4 accordingly.
2. **The model is not a participant control.** The prototype ships a female/male
   selector the brief does not mention. Exposing it would add an uncontrolled variable
   to a study about skin-tone congruence, so it is derived from the gender answer, with
   the pool default for "prefer not to say" so that declining carries no visible
   consequence.
3. **The colour pool is the prototype's ten saturated hues.** They share one saturation
   and lightness and differ only in hue, which is what makes a colour choice
   attributable to hue rather than to one swatch being brighter. The prototype's
   "Original" and "White" swatches are excluded.
4. **The text sub-controls are kept but do not count as engagement.** Font size, ink
   colour and drag position are genuine prototype features and their final values are
   stored, but only the presence of text counts, so nobody is credited twice for
   adjusting one feature.
5. **The reveal is punctuated differently from the brief.** The brief writes it as one
   sentence joined by an em dash; it is served as two lines instead, with the attribution
   parenthesised beneath the colour name. The words are the brief's words and both
   conditions stay matched in tone and length — only the punctuation and line break
   differ, so that the attribution does not compete with the colour name for attention.
6. **The customisation prompt lists what can be changed.** Levels 2 and 3 name their
   available changes as a list before "Start customising", so nobody has to discover a
   control to know it exists. The list is built per level on the Worker, so a Level 2
   participant is never sent the Level 3 item.

   The Level 3 entry reads "Change the model's skin tone to match yours". This was
   chosen deliberately after the alternative was put, and it carries a consequence for
   analysis: **skin-tone matching at Level 3 is matching under instruction, not
   spontaneous matching.** A participant who ends near their own tone may be complying
   with the prompt rather than revealing a preference, and the two cannot be separated
   after the fact. The measure is still comparable across conditions and generations,
   because every Level 3 participant receives the identical instruction, so
   condition-by-level effects remain interpretable; what cannot be claimed is that
   matching occurred unprompted. This belongs in the limitations section. The control
   itself gives no target, no reference and no closeness feedback, so precision of
   match remains the participant's own judgement.

Two further changes were made without asking, both invisible to participants:

- **The prototype's retail styling is gone.** No display serif, no "Women's Essentials"
  eyebrow, no "Add to bag". A participant who reads the page as a shop would rate
  purchase intention against a shop.
- **The images are separate files, loaded on demand.** The prototype inlined all twelve
  garments as base64 in a 9.2MB file and precomputed all twelve before the first paint —
  slow on a phone and a plausible out-of-memory crash. A Level 1 participant now
  downloads 0.55MB instead of 6.56MB; Levels 2 and 3 load one garment up front and warm
  the rest in the background. The rendering maths is untouched.

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the full walkthrough from a clean slate.
