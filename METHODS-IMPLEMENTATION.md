# Implementation brief for the dissertation writer

What the software actually does, written for whoever is drafting the methodology and
results chapters. It is a description of the instrument as built, not of the literature
or the hypotheses. Where the build departs from the original brief, or where a measure
means something narrower than its name suggests, that is called out rather than smoothed
over — those points belong in Methods and Limitations, and they cannot be recovered from
the dataset alone.

Source of truth is the code, not this file. The experimental design lives in
`src/study-design.js`, allocation in `src/randomise.js`, the stage logic in
`src/study-service.js`, and the exported variables in `tools/export-csv.mjs`.

---

## 1. What the artifact is

A web-based experimental simulation of an online T-shirt purchase. Each participant is
shown a garment rendered on a photographed model, in a colour the design chose for them,
with a level of customisation control the design chose for them. They then rate the
garment. The whole thing runs as a single-page application served by a Cloudflare Worker,
with responses written to MongoDB Atlas.

It is a between-subjects experiment. No participant sees more than one condition, and no
participant is told that other conditions exist.

## 2. Design as implemented

Three factors, giving **12 cells**:

| Factor | Levels | Assigned how |
|---|---|---|
| Generation | Gen X, Gen Z | Not randomised — derived from birth year |
| Colour condition | Liked, Disliked | Randomised |
| Customisation level | 1, 2, 3 | Randomised |

Generation is a measured subject variable, not a manipulation. It is derived server-side
from the birth year: Gen X is 1965–1980, Gen Z is 1997–2008. Anyone outside both ranges is
declared ineligible and cannot proceed, so there is no middle-cohort data.

Cell numbering follows the brief's table exactly: Gen X occupies cells 1–6 and Gen Z 7–12,
Liked before Disliked, level ascending within each.

**Target is 20 completed responses per cell, 240 total.** See §5 for why 20 is a floor
rather than an exact quota.

## 3. The participant journey

Five stages. One database document is created at Stage 1 and updated as each stage
finishes, which is what makes resume possible.

**Stage 1 — Consent.** Information sheet, an affirmative checkbox, and a decline option.
A session document is created the moment consent is given, recording the language the
consent form was read in.

**Stage 2 — Onboarding.** Birth year (drives eligibility and generation), gender, and two
experience questions: `ex1`, years of online shopping experience on a 1–5 banded scale
(under 1 year → 10 years or more), and `ex2`, purchase frequency on a 1–5 scale (a few
times a year → several times a week). An email address is also collected here, but see §8
— it is hashed and stored apart from the response data, purely to stop one person
completing the study twice.

**Stage 3 — Colour calibration.** The participant is shown a pool of **ten hues** and picks
their most liked, then, on a separate screen, their least liked. The two must differ. The
pool holds saturation and lightness constant (S = 0.647, L = 0.5) and varies only hue, so
a preference is attributable to hue rather than to one swatch simply being brighter.

The two picks are separated by interstitial screens and followed by a summary showing both
choices, because pilot feedback showed respondents mistaking the second palette for the
first appearing twice through a bug. The summary tells them an algorithm will assign one of
the two colours — true, and it is the cover story that makes the manipulation survive
without deception about the mechanism.

**Stage 3.5 — Assignment** (invisible to the participant). The colour condition and the
customisation level are drawn here. See §5.

**Stage 4 — Treatment.** The garment is revealed in the assigned colour with a one-sentence
framing, and the participant works with whatever controls their level allows:

- **Level 1**: no controls. View only.
- **Level 2**: custom text (with font size, ink colour and drag position as
  sub-controls), sleeve length, neck type.
- **Level 3**: everything in Level 2, plus a skin-tone slider on the model.

Time on this stage is recorded.

**Stage 5 — Questionnaire.** Eight items, seven-point Likert, strongly disagree to strongly
agree. This is the only place `completed` is set to true.

| Id | Construct | Item (English) |
|---|---|---|
| `pin1` | Purchase intention | I would buy this T-shirt if I had the chance. |
| `pin2` | Purchase intention | I will probably buy this T-shirt at some point. |
| `pin3` | Purchase intention | I am willing to buy the T-shirt exactly as I just saw it. |
| `po1` | Psychological ownership | This feels like my T-shirt. |
| `po2` | Psychological ownership | I feel a strong sense of owning this T-shirt. |
| `po3` | Psychological ownership | This T-shirt feels like it belongs to me. |
| `pa1` | Perceived agency | I felt like I was in control of how this T-shirt looked. |
| `cp1` | Colour preference | I like the colour of this T-shirt. |

`pa1` and `cp1` are **single-item measures**. `cp1` functions as the manipulation check for
the colour condition: if the Liked and Disliked groups do not separate on it, the
manipulation did not land, and that result governs how everything else is read.

## 4. Languages

The whole instrument runs in **English, Sinhala and Tamil**. The language is chosen by the
participant, fixed at consent, stored on the document, and never revised — a scale answered
in one wording having been read in another is not the same measurement. It is exported as
its own column.

Two things the writer must know. First, nothing in the randomisation balances language
across the twelve cells, so imbalance is possible and should be checked before language is
treated as noise. Second, the Sinhala and Tamil scale anchors were corrected during
development: "strongly" had been rendered with words closer to "tightly" and "harshly", and
now reads "completely". Any pilot responses collected in those languages before that fix
are not strictly comparable with responses after it. The wider translation of the eight
items has not yet been signed off by a native speaker.

## 5. Randomisation — the part most likely to be misdescribed

The correct description is: **stratified random assignment with a restricted draw**.

- **Stratified** by generation. Generation is already fixed by birth year, so the draw is
  among the six condition-by-level cells belonging to that participant's generation.
- **Restricted**, in that a cell is withdrawn from the draw once it reaches the target.
- **Uniform** over whatever cells remain open. The draw is not weighted by remaining
  capacity, deliberately, so that "each participant was allocated with equal probability to
  any cell not yet at target" is literally true.
- **Cryptographically random.** The draw uses the platform CSPRNG rather than
  `Math.random`, and rejects the tail of the 32-bit range that would otherwise make low
  indices marginally more likely.
- **Atomic.** Assignment runs inside a single Cloudflare Durable Object, which processes one
  request at a time, so counts cannot change between being read and the cell being written.
- **Never re-drawn.** An assignment already on the document is returned untouched, so a
  participant who closes the browser and returns sees the same colour and the same controls.

It is **not** block randomisation, and it is not simple randomisation. Do not describe it as
either.

**Only completed responses count against a cell.** An abandoned session holds no slot, which
stops a run of drop-outs from starving a cell that never actually filled.

**The cap is soft, and this needs stating in Methods.** Because a cell is only withdrawn at
20 *completed* responses, and assignment happens at Stage 3.5 while completion happens at
Stage 5, several sessions can be assigned to a cell that is at 19 and all go on to complete.
Final cell sizes can therefore exceed 20 and will not be perfectly equal. Report achieved
cell sizes; do not assume 20. If every cell for a generation is full, that participant is
shown a "no longer accepting responses" screen rather than being assigned.

## 6. Derived measures

**`engagementIndex`** counts distinct customisation decisions actually made, comparing the
submitted state against the defaults in force when Stage 4 loaded. It exists to separate a
participant who used their controls from one who clicked through leaving everything
untouched.

- Level 1: always 0 — no controls were offered.
- Level 2: 0–3 from `textEdited`, `sleeveChanged`, `neckChanged`.
- Level 3: 0–4, adding `skinToneAdjusted`.

The index is therefore not comparable in absolute terms across levels: a Level 2 participant
who used everything scores 3, a Level 3 participant who used everything scores 4. Compare
within level, or normalise against the level maximum, rather than treating the raw count as
one continuous variable across the whole sample.

Note also that the index is a count of distinct features touched, not of effort. Font size,
ink colour and text position are stored but excluded from the count, so a participant cannot
score twice for fiddling with the same feature.

`skinToneAdjusted` is the one flag not derived by comparing values, because the slider's
default is computed from the photograph's own average skin lightness and a participant can
drag away and back. The renderer reports whether the control was ever touched.

## 7. Data quality safeguards

- **Duplicate prevention.** One completion per email address, enforced by hash. A session
  that has already registered its address is not re-checked, so a retry after a network
  error cannot make someone collide with themselves.
- **Fast-completion flag.** Stage 4 under **15 seconds** sets `flaggedFast`. The response is
  still saved. The decision to exclude is yours at analysis time — blocking the submission
  would have lost the response and still not told anyone whether it was rushed.
- **Server-side validation.** Colour picks must come from the pool and must differ; Likert
  answers must be integers in 1–7; stages must be completed in order. None of this is
  trusted from the browser.
- **Engagement derived server-side** from the level on the document, so a browser cannot
  claim to have used a control it was never given.
- **Abandoned sessions** older than 30 days can be removed by an admin cleanup call. It is
  manual, never automatic, and never touches completed responses.

## 8. Privacy and data handling

Email addresses are stored **hashed, in a separate collection**, with no link back to the
response document. The response data contains no address and no identifier that resolves to
one. At close of collection the hashes can be deleted outright, leaving the experimental
data intact and analysable.

The exported dataset carries a random `sessionId`, the design variables, demographics
(birth year, gender, language), the two experience answers, colour choices, task behaviour
and the eight item scores. Gender is used server-side to select which photographed model is
shown (female is the default, and participants who decline to state a gender receive it, so
declining carries no visible consequence). The model is never a participant-facing control —
exposing it would add an uncontrolled variable to a study about skin-tone congruence.

## 9. Blinding

Blinding is structural rather than procedural. The experimental design — condition names,
level numbers, the cell map, allocation targets, and the reveal wording for both conditions
— lives in server-only files that are never sent to a browser. The client is told the colour
to draw and whether customisation is available, and is handed a finished reveal sentence and
a finished list of what it may change. It is never told which of the twelve cells it is
rendering.

Both reveal sentences are matched in length and tone and differ only in a final clause, so
neither version tells a participant how to feel about the colour moments before they rate it.

**One honest limit, worth a line in Limitations.** The rendering engine ships to every
participant because everyone needs the garment drawn, and it necessarily contains the
skin-tone mathematics. A determined Level 2 participant who read several hundred lines of
image-processing code could infer that recolouring skin is possible somewhere in the study.
What they cannot obtain is the control itself: it is never in their page, never in their
JavaScript, and the server refuses to serve it to their session.

## 10. Exported variables

`tools/export-csv.mjs` writes one row per completed participant with a fixed column set,
present for every participant and empty where a control was never shown. **Empty means "not
offered", not "offered and declined"** — that distinction matters when coding missingness.

Columns: `sessionId`, `cellId`, `generation`, `condition`, `level`, `birthYear`, `gender`,
`language`, `onlineShoppingYears`, `purchaseFrequency`, `likedColourHex`,
`dislikedColourHex`, `shownColourHex`, `stage4Seconds`, `flaggedFast`, the nine
`cust*` customisation values, the four engagement booleans, `engagementIndex`, the eight
item scores, `purchaseIntentionMean`, `ownershipMean`, `startedAt`, `submittedAt`.

Booleans export as 1/0 for SPSS. The two mean columns are a convenience — the items remain
the source of truth, so reliability analysis should be run on those before the means are
trusted.

## 11. Things that are true of the build and should not be overclaimed

- Generation is **not** randomised. Any generational difference is correlational and
  carries all the usual confounds of a cohort comparison.
- Final cell sizes will not be exactly 20 or exactly equal (§5).
- `pa1` and `cp1` are single items, so neither has an internal reliability estimate.
- The Level 3 skin-tone control **instructs participants to match their own tone**. This was
  a deliberate researcher decision and it changes what the measure means: matching becomes
  partly an instruction followed rather than a preference revealed. It should be described
  as matching under instruction. The control itself gives no reference, no target and no
  closeness feedback, so how near a participant lands remains their own judgement.
- There is no attention check beyond the Stage 4 timing flag.
- Language is self-selected and unbalanced across cells (§4).
- Sinhala and Tamil item translations are not yet expert-verified (§4).

## 12. Not part of the dataset

The deployed application carries a token-gated preview tool that seeds a session in a named
cell, used for demonstrating the design. Sessions it creates are tagged and filtered out of
per-cell counts and every export, so they cannot consume an allocation slot or reach the
data. It is a presentation aid with no bearing on the methodology and does not need
describing in the dissertation.
