# Build Brief: Digital Chameleon Effect — Experimental Simulation Platform

## 1. What this is

A web-based experiment for a university dissertation. Participants go through a 5-stage journey: consent, onboarding, colour calibration, a randomly assigned treatment task, and a post-task questionnaire. The platform must randomly assign each participant to 1 of 12 experimental conditions, keep them blind to any condition other than their own, and log every response to a database. This is a research instrument, not a retail product — accuracy of randomisation and data logging matters more than polish.

An existing prototype HTML file will be provided separately. It already contains **working, functional code** for four interactive controls: colour selection, skin-tone slider, sleeve length selector, and neck/collar type selector. Do not rebuild these controls from scratch. Your job is to **wire the existing prototype into the full 5-stage flow described below**, add the missing stages (consent, onboarding, calibration, questionnaire), add the conditional logic that shows/hides controls per assigned level, and connect everything to the backend.

## 2. Tech stack (fixed, not open to substitution)

- **Hosting/deployment:** Cloudflare (Pages for the static frontend; Workers for any server-side logic such as the randomisation endpoint and the database write/read layer). This is a **brand new deployment** — there is no existing Cloudflare project, account setup, or infrastructure to reuse. Build from a clean slate.
- **Database:** MongoDB (Atlas, or connected via a Cloudflare Worker). All participant responses, condition assignments, and duplicate-control records are stored here. This is also a fresh cluster with no existing collections.
- **Frontend:** Plain HTML/CSS/JS is acceptable and preferred, since the existing prototype is built that way. If a framework is used, it must still deploy cleanly as a Cloudflare Pages static build.

## 3. Session handling and resume

A `sessionId` (random UUID) is generated the moment a participant clicks "I agree and proceed" on the consent screen, and stored in the browser (localStorage or a cookie — your choice, but it must survive a closed tab and a reopened browser on the same device). This `sessionId` is the single thread linking every stage together.

**Resume behaviour:** if a participant returns to the site with a `sessionId` already stored in their browser, the system should look up that session's saved progress in MongoDB and return them to the stage they left off at, with all previously entered data intact — not restart from Stage 1. This means every stage's data must be saved to the database as the participant completes it, not only at final submission (see Section 6 for how this interacts with the "only count completed responses" requirement).

**Critical rule for resume:** once Stage 4's condition and level have been assigned to a session, that assignment is permanent and must be reloaded on resume, never re-randomised. A participant who closes the browser mid-Stage-4 and returns must see the same colour and the same customisation level they were originally given.

If no `sessionId` is found in the browser, treat the visit as a new participant and start at Stage 1 as normal.

## 4. The five-stage participant journey

### Stage 1: Consent
Full-screen page, single block of text, one checkbox or button to proceed. No back button needed before this point.

> "This study is conducted as part of a BSc (Hons) dissertation at the University of Kelaniya. Your participation is entirely voluntary and you may withdraw at any time by closing the browser. All responses are anonymised; your email address is collected solely for duplicate-response control, stored separately from your answers, and deleted once data collection closes. No personally identifiable information will appear in the final report. By clicking 'I agree and proceed' you confirm that you are 18 years of age or older and consent to participate."

Button: **I agree and proceed**. Declining should simply end the session (no data written).

### Stage 2: Onboarding
Collect the following, in this order, with required-field validation before continuing:

| Field ID | Question | Input type | Validation |
|---|---|---|---|
| D1 | What is your birth year? | Numeric input | Must fall in 1965–1980 OR 1997–2008. Anything outside both ranges shows: "This study is currently only open to participants born between 1965–1980 or 1997–2008." and blocks progress. |
| D2 | What is your gender? | Radio/select: Male / Female / Prefer not to say | Required |
| D3 | What is your email address? | Email input | Standard email format validation. See Section 7 on how this is stored. |
| EX1 | For how long have you been shopping online? | Radio/select, 5-point scale | 1 = Less than 1 year, 2 = 1–2 years, 3 = 3–5 years, 4 = 6–9 years, 5 = 10 years or more |
| EX2 | How often do you make online purchases? | Radio/select, 5-point scale | 1 = Rarely, a few times a year, 2 = Every few months, 3 = Monthly, 4 = Weekly, 5 = Several times a week |

D1 also silently determines the participant's **Generation** (Gen X: 1965–1980, Gen Z: 1997–2008). This value is stored but never shown to the participant as a label.

### Stage 3: Calibration
Present the participant with a **10-hue colour pool** (exact hex/HSL values to be supplied separately — build the UI to accept a configurable array of 10 colours, don't hardcode assumptions about which 10).

1. **C1:** "From the colours below, select the one you would most like to see on a casual T-shirt." — participant picks 1 of 10.
2. **C2:** "Now select the colour you would least like to see on a casual T-shirt." — participant picks 1 of the **remaining 9** (the C1 selection should be removed or disabled from this second screen).

Store both C1 and C2 hex values against the participant record. These become their personal "Liked" and "Disliked" colours.

### Stage 3.5: Loading and Reveal
This sits between Calibration and Treatment. Randomisation (Section 6) fires the moment this stage begins, so the assigned condition, level, and cell are locked in before the reveal message is shown. This stage exists to confirm the colour assignment factually, without cueing an emotional reaction, since telling a participant how to feel right before they answer the questionnaire would bias their responses.

**Loading screen** (identical wording for every participant, regardless of condition):
> "Preparing your T-shirt…"

Show a brief spinner or equivalent loading animation for roughly 1–2 seconds (simulated delay is fine, no real processing is happening). Same duration and same visual for everyone.

**Reveal screen**, same sentence structure for both conditions, only the final clause differs:

- **Liked condition:** "This T-shirt is in [colour name] — the colour you told us you like the most."
- **Disliked condition:** "This T-shirt is in [colour name] — the colour you told us you like the least."

`[colour name]` should be a plain descriptive label for the hex value (e.g. "teal", "coral") if you have named labels for the 10-hue pool; otherwise default the phrase to "This T-shirt is in this colour — the colour you told us you like the most/least" and just show the rendered swatch. Do not add exclamations, emoji, celebratory or sympathetic framing, or any language implying the participant should feel good or bad about the result. Both versions should read as neutral confirmations of fact, matched in tone and length.

Button: **Continue**

### Stage 4: Treatment (uses the existing prototype)
By this point randomisation has already fired at the start of Stage 3.5 (see Section 6 for the full assignment logic), so the participant's condition, level, and cell are already known. Render the prototype T-shirt using:
- **Colour:** the participant's own C1 (if assigned Liked) or C2 (if assigned Disliked) value from Stage 3. This colour is **locked** — no colour picker or swatch control should be shown or enabled at any level, at any point in Stage 4.
- **Customisation controls shown:** depends on assigned Level. See table below.

For Level 2 and Level 3 participants, show a short prompt before the controls appear, using **identical wording for both levels** so a Level 2 participant sees nothing implying a Level 3 exists:

> "You can now customise this T-shirt."
> Button: **Start customising**

Level 1 participants skip this prompt entirely and go straight from the Stage 3.5 reveal to the static view described below, since there is nothing for them to customise.

| Assigned Level | Controls visible/enabled | Controls hidden entirely |
|---|---|---|
| Level 1 (Static) | None. Just the rendered T-shirt and a "Continue" button. | Text/graphic editor, sleeve length, neck type, skin-tone slider — none of these should be visible, referenced, or hinted at. No customisation prompt is shown at this level. |
| Level 2 (Product) | Text input, graphic/icon picker, sleeve length selector, neck type selector | Skin-tone slider must not be visible or hinted at. |
| Level 3 (Holistic) | Everything in Level 2, plus the skin-tone slider | — |

**Critical requirement: blinding.** A Level 1 or Level 2 participant must have no way to discover that higher levels exist — no greyed-out controls, no "upgrade" prompts, no console logs revealing other conditions, nothing in the page source that a curious participant could find by viewing page source or inspecting network requests in an obvious way. Each participant's build of the page should only ever contain the controls for their own assigned level.

The skin-tone slider (Level 3 only) has no "correct" position and no comparison shown against any reference — it is simply an available customisation option like the others. Do not add any confirmation, matching score, or feedback about how closely it matches anything.

Log **completion time** for this stage (timestamp when Stage 4 loads to timestamp when the participant clicks Continue).

### Stage 5: Post-task questionnaire
All items below use a 7-point Likert scale unless noted. Render as a single scrollable form (radio buttons or a numbered 1–7 scale per item), not one question per screen.

| ID | Item wording | Scale |
|---|---|---|
| PIN1 | "I would buy this T-shirt if I had the chance." | 1 (Strongly Disagree) – 7 (Strongly Agree) |
| PIN2 | "I will probably buy this T-shirt at some point." | 1–7 |
| PIN3 | "I am willing to buy the T-shirt exactly as I just saw it." | 1–7 |
| PO1 | "This feels like my T-shirt." | 1–7 |
| PO2 | "I feel a strong sense of owning this T-shirt." | 1–7 |
| PO3 | "This T-shirt feels like it belongs to me." | 1–7 |
| PA1 | "I felt like I was in control of how this T-shirt looked." | 1–7 |
| CP1 | "I like the colour of this T-shirt." | 1–7 |

On submit: write the full response record to MongoDB (see Section 6), show a simple "Thank you for participating" screen, and end the session. No further navigation should be possible from this screen (disable back button behaviour or redirect any back-navigation attempt to the thank-you screen).

## 5. Design and UX requirements

- Mobile-responsive throughout; assume a meaningful share of participants will use a phone.
- No visual branding, logos, or styling that implies a real retail store — keep it neutral/academic. A clean, simple look is fine; this does not need to look like a polished e-commerce site.
- No progress bar that reveals total stage count in a way that hints at hidden complexity in Stage 4 (a generic "Step 3 of 5" is fine; the Stage 3.5 reveal screen can be folded into the same step number as Calibration or Treatment on the progress indicator, since it is a short transitional screen rather than a distinct stage from the participant's point of view).
- Every stage must block progression until required fields are complete.

## 6. Randomisation logic

On first entering Stage 4, the system must assign the participant to exactly one of 12 cells:

- **Colour condition:** Liked or Disliked (50/50 random)
- **Customisation level:** 1, 2, or 3 (random, roughly even across the three)
- **Generation:** already determined from D1, not randomised

This produces the 12-cell structure below. The system does not need to show this table to the participant; it is here so you understand the target distribution.

| | Liked | Disliked |
|---|---|---|
| Gen X, Level 1 | Cell 1 | Cell 4 |
| Gen X, Level 2 | Cell 2 | Cell 5 |
| Gen X, Level 3 | Cell 3 | Cell 6 |
| Gen Z, Level 1 | Cell 7 | Cell 10 |
| Gen Z, Level 2 | Cell 8 | Cell 11 |
| Gen Z, Level 3 | Cell 9 | Cell 12 |

**Target allocation:** 20 completed responses per cell, 240 total. The randomisation should be **cell-count-aware**, not pure coin-flip for the whole run: as certain cells fill up (reach 20 responses with `completed: true`), the system should stop assigning new participants to that cell and randomise only among the remaining open cells. This requires the assignment logic to query current completed counts per cell from MongoDB before assigning each new participant, filtering strictly on `completed: true` — an in-progress or abandoned session in a cell does not count against that cell's cap. Provide a simple way (even just a MongoDB query or a basic admin view) to check current per-cell completed counts.

If every cell is full, show a "This study is no longer accepting responses, thank you for your interest" screen instead of proceeding to Stage 4.

## 7. Data schema (MongoDB)

Use two separate collections so identifying information and experimental data are never joined in normal queries:

**`participants`** (identity/duplicate-control only)
```
{
  _id,
  emailHash,        // hashed, not plaintext — see note below
  createdAt
}
```

**`responses`** (experimental data, no email or plaintext identifier)
```
{
  _id,
  sessionId,             // random UUID generated at Stage 1, links this record's stages together
  birthYear,
  generation,             // "GenX" | "GenZ", derived from birthYear
  gender,
  ex1, ex2,
  likedColourHex,         // from C1
  dislikedColourHex,      // from C2
  assignedCondition,      // "Liked" | "Disliked"
  assignedLevel,          // 1 | 2 | 3
  cellId,                 // 1-12, derived from generation + condition + level
  stage4CompletionSeconds,
  customisation: {
    text, graphic, sleeveLength, neckType, skinTone,   // only fields relevant to assigned level need to be populated
    textEdited,          // boolean: true if text differs from default/placeholder (empty string)
    graphicSelected,      // boolean: true if a non-default graphic was chosen
    sleeveChanged,        // boolean: true if sleeve length differs from its default value
    neckChanged,           // boolean: true if neck type differs from its default value
    skinToneAdjusted,     // boolean, Level 3 only: true if slider was moved from its default position
    engagementIndex       // integer: sum of the booleans above that apply to the participant's assigned level (max 4 at Level 2, max 5 at Level 3, always 0 at Level 1)
  },
  pin1, pin2, pin3,
  po1, po2, po3,
  pa1,
  cp1,
  startedAt,
  submittedAt,
  lastUpdatedAt,
  completed: false        // set true only on final Stage 5 submit
}
```

**Engagement fields, and why they matter.** These five booleans and the derived `engagementIndex` exist to distinguish participants who actually used the customisation controls they were given from participants who left everything at its default and simply clicked through. This is a real analytical gap without them: two Level 2 participants could end up with identical stored `customisation` values (both left at default) yet be treated identically in analysis as "customised," when one never engaged at all. Compute each boolean by comparing the final stored value against that field's default value at the moment Stage 4 loaded — not by tracking every intermediate edit, just a before/after comparison at submission. `engagementIndex` is the count of `true` values among the booleans relevant to the participant's assigned level (Level 1 always has an index of 0 and can skip the individual booleans entirely; Level 2 sums `textEdited`, `graphicSelected`, `sleeveChanged`, `neckChanged`; Level 3 sums those four plus `skinToneAdjusted`). This does not require any timestamp or keystroke tracking, a single comparison against defaults when Stage 4 is submitted is sufficient.

**How progressive saving and resume interact with "only final responses count."** One document is created per `sessionId` the moment Stage 1 is completed, and it is updated (upserted, keyed on `sessionId`) as the participant completes each subsequent stage — this is what makes resume possible, since there is always a saved record to resume from. However, `completed` stays `false` until the participant submits Stage 5. Every query that matters for the study — the per-cell counts used in randomisation (Section 6), the 240-response target, and the dataset used for analysis — must filter on `completed: true` only. An abandoned session sits in the database as an incomplete document and is simply ignored by every count and every export; it does not consume one of the 20 slots in its assigned cell unless and until it is completed. Build a scheduled or manual cleanup option to remove documents where `completed: false` and `lastUpdatedAt` is older than, say, 30 days, so abandoned sessions don't accumulate indefinitely, but this is a housekeeping convenience, not something that needs to run automatically from day one.

**Duplicate control:** hash the email (e.g. SHA-256) before storing in `participants`; never store plaintext email anywhere in the database. Before allowing a new session to proceed past Stage 2, check whether the hashed email already exists in `participants`. If it does, show: "It looks like you've already participated in this study. Thank you again for your time." and end the session without writing to `responses`.

**Deletion requirement:** the `participants` collection (email hashes) must be deletable independently of `responses` once data collection closes, without affecting the experimental data. Build this as a simple script or admin action, not something requiring manual document-by-document deletion.

**Completion-time flagging:** if `stage4CompletionSeconds` is below a threshold you can leave as a configurable constant (default 15 seconds), still save the response but set an additional field `flaggedFast: true` so it can be reviewed/excluded during analysis rather than blocking submission outright.

## 8. What you're receiving alongside this brief

A working prototype HTML file containing functional code for:
- Colour rendering on the T-shirt graphic
- Skin-tone slider (continuous, live-updating)
- Sleeve length selector
- Neck/collar type selector

Treat this as the source of truth for how these four controls behave and look. Integrate it into Stage 4 rather than reimplementing it. If anything in this brief conflicts with what the prototype actually does, flag the conflict back rather than guessing.

## 9. Explicitly out of scope

- Payment processing, checkout, cart — none of this is a real store.
- Login/account creation beyond the single email-for-duplicate-control step.
- Marketing pages, SEO, analytics trackers, cookies beyond what's needed for session continuity.
- Any AI-generated or automatically rendered garment images beyond what the existing prototype already does — colour/customisation is CSS or asset-swap based, not generative.
