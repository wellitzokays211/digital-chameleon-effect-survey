/* English copy: the reference catalogue.
 *
 * Every other catalogue is checked against this one, so a key added here and nowhere
 * else falls back to English and is reported by tools/self-check.mjs rather than
 * appearing as a blank on a participant's screen.
 *
 * Two rules for anyone editing this file.
 *
 * Whole sentences, never fragments joined in code. Sinhala and Tamil are both
 * verb-final, so an English sentence assembled from pieces in English order cannot be
 * reordered by a translator no matter how good the translation of each piece is.
 * Variables go inside the sentence as {named} placeholders.
 *
 * The eight questionnaire items and the consent body are not copy. The items are
 * measurement instruments and the consent body is an ethics document; changing their
 * wording changes what the study measures and what the participant agreed to, in every
 * language at once. */

export default {
  /* ---------------- shared ---------------- */

  'common.continue': 'Continue',
  'common.submit': 'Submit',
  'common.saving': 'Saving\u2026',
  'common.starting': 'Starting\u2026',
  'common.submitting': 'Submitting\u2026',
  'common.loading': 'Loading\u2026',
  'common.tryAgain': 'Try again',
  'common.selectOption': 'Please select an option.',
  'common.thankYou': 'Thank you',

  /* Joins the two eligible birth-year ranges inside onboarding.ineligible. A separate
     entry because it is a conjunction, and a translation that needs "and" where English
     needs "or", or no word at all, has nowhere to say so if it is baked into code. */
  'common.rangeJoin': ' or ',

  /* The step counter is a sentence with two numbers in it, not the literal text
     "Step 3 of 5". Which stage carries which number lives in study-config.js. */
  'step.format': 'Step {current} of {total}',

  /* ---------------- Stage 1: consent ---------------- */

  'consent.title': 'Information and consent',

  /* Names the agree button through a placeholder rather than quoting it, so the two
     cannot drift apart: a translator who renders the button one way and the sentence
     another leaves the participant hunting for a button that is not there. */
  'consent.body':
    'This study is conducted as part of a BSc (Hons) dissertation at the University of ' +
    'Kelaniya. Your participation is entirely voluntary and you may withdraw at any time ' +
    'by closing the browser. All responses are anonymised; your email address is collected ' +
    'solely for duplicate-response control, stored separately from your answers, and ' +
    'deleted once data collection closes. No personally identifiable information will ' +
    'appear in the final report. By clicking \u2018{agreeButton}\u2019 you confirm that you ' +
    'are 18 years of age or older and consent to participate.',

  'consent.checkbox':
    'I have read and understood the above, I am 18 or older, and I consent to participate.',
  'consent.agree': 'I agree and proceed',
  'consent.decline': 'I do not wish to participate',
  'consent.confirmRequired': 'Please confirm the statement above to continue.',

  /* ---------------- Stage 2: onboarding ---------------- */

  'onboarding.title': 'A few questions about you',
  'onboarding.lede': 'All fields are required.',

  'onboarding.birthYear': 'What is your birth year?',
  'onboarding.birthYearPlaceholder': 'e.g. 1975',
  'onboarding.birthYearRequired': 'Please enter your birth year.',
  'onboarding.birthYearFourDigits': 'Please enter a four-digit year.',
  /* The ranges are filled in from BIRTH_YEAR_RANGES rather than typed out, so moving a
     range in one place cannot leave three languages quoting the old one. */
  'onboarding.ineligible':
    'This study is currently only open to participants born between {ranges}.',

  'onboarding.gender': 'What is your gender?',
  'gender.Male': 'Male',
  'gender.Female': 'Female',
  'gender.Prefer not to say': 'Prefer not to say',

  'onboarding.email': 'What is your email address?',
  'onboarding.emailHint':
    'Used only to prevent duplicate responses. It is stored separately from your answers ' +
    'and deleted once data collection closes.',
  'onboarding.emailPlaceholder': 'you@example.com',
  'onboarding.emailRequired': 'Please enter your email address.',
  'onboarding.emailInvalid': 'Please enter a valid email address.',

  'onboarding.ex1': 'For how long have you been shopping online?',
  'ex1.1': 'Less than 1 year',
  'ex1.2': '1\u20132 years',
  'ex1.3': '3\u20135 years',
  'ex1.4': '6\u20139 years',
  'ex1.5': '10 years or more',

  'onboarding.ex2': 'How often do you make online purchases?',
  'ex2.1': 'Rarely, a few times a year',
  'ex2.2': 'Every few months',
  'ex2.3': 'Monthly',
  'ex2.4': 'Weekly',
  'ex2.5': 'Several times a week',

  /* ---------------- Stage 3: calibration ---------------- */

  'calibration.title': 'Colour preferences',
  'calibration.likedSubtitle': 'Most Liked Colour',
  'calibration.dislikedSubtitle': 'Least Liked Colour',

  /* The screens that separate the two palettes. They exist because the palettes are
     deliberately identical and a participant mistook the second for the first shown
     again by mistake; each of these says which of the two choices is coming next.

     "Most liked" and "least liked" throughout, matching the subheadings above, the
     swatch badges and the reveal sentence's "the colour you told us you like the most".
     A synonym here would give the participant a third vocabulary for two ideas, which
     is the confusion these screens were added to remove. */
  'calibration.introLikedTitle': 'Now let\u2019s pick your most liked colour.',
  'calibration.introDislikedTitle': 'Most liked colour locked.',
  'calibration.introDislikedBody': 'Now let\u2019s pick your least liked colour.',

  'calibration.summaryTitle': 'Your two colours',
  /* A disclosure about the design, not interface copy. It is accurate -- the condition
     is randomly assigned, and the garment carries whichever of these two colours goes
     with it -- and it tells the participant the colour was never theirs to choose.
     Reword with care: it is read immediately before the measures of ownership and
     perceived control. */
  'calibration.summaryNote':
    '(One of these two colours will be randomly chosen for your T-shirt)',
  'calibration.likedPrompt':
    'From the colours below, select the one you would most like to see on a casual T-shirt.',
  'calibration.dislikedPrompt':
    'Now select the colour you would least like to see on a casual T-shirt.',
  'calibration.hint': 'Your choice locks when you tap it. You can change it until you continue.',

  'calibration.locked': 'Locked',
  'calibration.mostLiked': 'Most Liked',
  'calibration.leastLiked': 'Least Liked',

  /* Separate entries rather than lower-casing the badge text in code. Neither Sinhala
     nor Tamil has letter case, so toLowerCase() is a silent no-op in two languages out
     of three and the sentence reads as though a proper noun had been dropped into it. */
  'calibration.mostLikedInline': 'most liked',
  'calibration.leastLikedInline': 'least liked',
  'calibration.swatchLockedTitle': '{colour} (locked as your {role})',
  'calibration.swatchLockedAria': '{colour}, locked as your {role}',

  /* ---------------- colour names ----------------
   *
   * Ten hues at one saturation and one lightness, so the only thing separating them is
   * their name. Several sit close together -- magenta at 307 degrees, pink-magenta at
   * 324, pink-red at 340 -- and English barely distinguishes those three itself.
   *
   * Colour vocabularies do not divide the spectrum the same way across languages, and
   * the reveal sentence names one of these ten back to the participant as the thing
   * they chose. If two swatches collapse onto one word in a translation, two different
   * treatments are described identically and the manipulation stops being specific.
   * Keeping ten distinct names matters more here than any one of them being the most
   * idiomatic word available. */
  'colour.red_orange': 'red-orange',
  'colour.orange': 'orange',
  'colour.yellow_gold': 'yellow-gold',
  'colour.green': 'green',
  'colour.teal': 'teal',
  'colour.blue': 'blue',
  'colour.blue_violet': 'blue-violet',
  'colour.magenta': 'magenta',
  'colour.pink_magenta': 'pink-magenta',
  'colour.pink_red': 'pink-red',

  /* ---------------- Stage 3.5: loading and reveal ---------------- */

  'reveal.preparing': 'Preparing your T-shirt\u2026',
  'reveal.preparingAria': 'Preparing',
  'reveal.failedTitle': 'We could not prepare your T-shirt',

  /* ---------------- Stage 4: treatment ----------------
   *
   * Both hints live here, in the catalogue every participant receives, which is the
   * same boundary the English build already draws: public/stage4/host.js has always
   * carried both. What must not be here is anything naming a control -- those are in
   * src/strings-server.js and are sent only with the controls a session is entitled to.
   *
   * The two are matched on purpose. stage4CompletionSeconds is measured for
   * participants with controls and without, so if one group were urged to linger and
   * the other were not, a difference in how long they took would be partly a difference
   * in what they were asked to do. Both invite the same pause and name the same
   * button; change neither without changing the other, in all three languages. */
  'stage4.lookHint': 'Take a moment to look at this T-shirt, then click {continueButton}.',
  'stage4.customiseHint':
    'Take a moment to customise and then click {continueButton} when you are ready.',
  'stage4.controlsUnavailable': 'The customisation options could not be loaded.',

  /* ---------------- Stage 5: questionnaire ---------------- */

  'questionnaire.title': 'A few final questions',
  'questionnaire.lede':
    'Rate each statement from 1 (strongly disagree) to 7 (strongly agree). All are required.',
  /* The two ends of the response scale, shown above every row. Reversing them inverts
     an item and leaves no trace in the data, so both the number and the word appear
     together and the direction is restated in scaleGuide below. */
  'questionnaire.likertMin': 'Strongly disagree',
  'questionnaire.likertMax': 'Strongly agree',
  'questionnaire.scaleGuide':
    'For every statement below, choose {min} if you strongly disagree and {max} if you strongly agree. The numbers in between are the steps from one to the other.',
  'questionnaire.rateRequired': 'Please rate this statement.',
  'questionnaire.allRequired': 'Please answer all {count} statements before submitting.',

  /* The eight items. Purchase intention (pin), psychological ownership (po), perceived
     agency (pa) and colour preference (cp). Translated versions of a validated scale
     are not interchangeable with the original: if one language reads stronger than
     another, language is confounded with condition and level. These need back
     translation, not review. */
  'item.pin1': 'I would buy this T-shirt if I had the chance.',
  'item.pin2': 'I will probably buy this T-shirt at some point.',
  'item.pin3': 'I am willing to buy the T-shirt exactly as I just saw it.',
  'item.po1': 'This feels like my T-shirt.',
  'item.po2': 'I feel a strong sense of owning this T-shirt.',
  'item.po3': 'This T-shirt feels like it belongs to me.',
  'item.pa1': 'I felt like I was in control of how this T-shirt looked.',
  'item.cp1': 'I like the colour of this T-shirt.',

  /* ---------------- terminal screens ---------------- */

  'message.duplicate':
    'It looks like you\u2019ve already participated in this study. Thank you again for your time.',
  'message.studyFull': 'This study is no longer accepting responses, thank you for your interest.',
  'message.thanks': 'Thank you for participating.',
  'message.declined': 'Thank you for your time. You may now close this window.',
  'message.genericError':
    'Something went wrong saving your response. Please check your connection and try again.',

  'terminal.recorded': 'Your response has been recorded. You may now close this window.',
  'terminal.alreadyRecorded': 'Your response has already been recorded. Thank you.',
  'terminal.unreachableTitle': 'We could not reach the study',
  'terminal.unreachableBody': 'Please check your connection and reload the page.'
};
