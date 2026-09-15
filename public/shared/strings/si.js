/* Sinhala copy. NOT YET VERIFIED BY A NATIVE SPEAKER.
 *
 * Every string here was translated by an AI assistant and is awaiting review. Where a
 * choice was not obvious the English is noted above the entry, so a reviewer can see
 * what was being aimed at rather than having to guess it back out of the Sinhala.
 *
 * Three groups need more than a read-through:
 *
 *  - The eight `item.*` entries are a validated questionnaire. They need forward and
 *    back translation, not proofreading. If the Sinhala reads stronger or weaker than
 *    the English, language becomes confounded with condition and level.
 *  - `consent.*` is an ethics document. Whatever wording is approved is the wording
 *    that must appear here, character for character.
 *  - The ten `colour.*` names must stay ten distinguishable names. Several of the hues
 *    are close together and the reveal sentence names one of them back to the
 *    participant, so two colours collapsing onto one word weakens the manipulation.
 *
 * Any key deleted or left as an empty string falls back to English on screen and is
 * listed by `npm run check`. */

export default {
  /* ---------------- shared ---------------- */

  'common.continue': 'ඉදිරියට',
  'common.submit': 'ඉදිරිපත් කරන්න',
  'common.saving': 'සුරකිමින්\u2026',
  'common.starting': 'ආරම්භ වෙමින්\u2026',
  'common.submitting': 'ඉදිරිපත් කරමින්\u2026',
  'common.loading': 'පූරණය වෙමින්\u2026',
  'common.tryAgain': 'නැවත උත්සාහ කරන්න',
  'common.selectOption': 'කරුණාකර විකල්පයක් තෝරන්න.',
  'common.thankYou': 'ස්තූතියි',

  /* Joins the two eligible birth-year ranges. Spaces are part of the string. */
  'common.rangeJoin': ' හෝ ',

  /* "Step {current} of {total}". Rendered as a fraction rather than as a sentence,
     which reads more naturally in Sinhala than the literal ordinal construction. */
  'step.format': 'පියවර {current} / {total}',

  /* ---------------- Stage 1: consent ---------------- */

  'consent.title': 'තොරතුරු සහ කැමැත්ත',

  'consent.body':
    'මෙම අධ්‍යයනය කැලණිය විශ්වවිද්‍යාලයේ BSc (Hons) උපාධි නිබන්ධනයක කොටසක් ලෙස සිදු කරනු ලැබේ. ' +
    'ඔබගේ සහභාගිත්වය සම්පූර්ණයෙන්ම ස්වේච්ඡාවෙන් වන අතර, බ්‍රවුසරය වසා දැමීමෙන් ඕනෑම මොහොතක ඔබට ' +
    'ඉවත් විය හැකිය. සියලුම ප්‍රතිචාර නිර්නාමික කරනු ලැබේ; ඔබගේ විද්‍යුත් තැපැල් ලිපිනය රැස් කරනු ලබන්නේ ' +
    'අනුපිටපත් ප්‍රතිචාර වැළැක්වීම සඳහා පමණක් වන අතර, එය ඔබගේ පිළිතුරුවලින් වෙන්ව ගබඩා කර, දත්ත ' +
    'රැස්කිරීම අවසන් වූ පසු මකා දමනු ලැබේ. පුද්ගලිකව හඳුනාගත හැකි කිසිදු තොරතුරක් අවසන් වාර්තාවේ ' +
    'ඇතුළත් නොවේ. \u2018{agreeButton}\u2019 ක්ලික් කිරීමෙන්, ඔබගේ වයස අවුරුදු 18ක් හෝ ඊට වැඩි බවත්, ' +
    'සහභාගී වීමට ඔබ කැමැත්ත දෙන බවත් ඔබ තහවුරු කරයි.',

  'consent.checkbox':
    'ඉහත සඳහන් දෑ මම කියවා තේරුම් ගෙන ඇත, මගේ වයස අවුරුදු 18 හෝ ඊට වැඩිය, සහ සහභාගී වීමට මම කැමැත්ත දෙමි.',
  'consent.agree': 'මම එකඟයි, ඉදිරියට යමි',
  'consent.decline': 'මට සහභාගී වීමට අවශ්‍ය නැත',
  'consent.confirmRequired': 'ඉදිරියට යාමට කරුණාකර ඉහත ප්‍රකාශය තහවුරු කරන්න.',

  /* ---------------- Stage 2: onboarding ---------------- */

  'onboarding.title': 'ඔබ ගැන ප්‍රශ්න කිහිපයක්',
  'onboarding.lede': 'සියලුම ක්ෂේත්‍ර පිරවීම අනිවාර්ය වේ.',

  'onboarding.birthYear': 'ඔබ උපන් වර්ෂය කුමක්ද?',
  'onboarding.birthYearPlaceholder': 'උදා: 1975',
  'onboarding.birthYearRequired': 'කරුණාකර ඔබ උපන් වර්ෂය ඇතුළත් කරන්න.',
  'onboarding.birthYearFourDigits': 'කරුණාකර ඉලක්කම් හතරක වර්ෂයක් ඇතුළත් කරන්න.',
  'onboarding.ineligible':
    'මෙම අධ්‍යයනය දැනට විවෘත වන්නේ {ranges} අතර උපන් සහභාගිවන්නන් සඳහා පමණි.',

  'onboarding.gender': 'ඔබගේ ස්ත්‍රී පුරුෂ භාවය කුමක්ද?',
  'gender.Male': 'පිරිමි',
  'gender.Female': 'ගැහැණු',
  'gender.Prefer not to say': 'පැවසීමට අකැමැතියි',

  'onboarding.email': 'ඔබගේ විද්‍යුත් තැපැල් ලිපිනය කුමක්ද?',
  'onboarding.emailHint':
    'අනුපිටපත් ප්‍රතිචාර වැළැක්වීම සඳහා පමණක් භාවිත කෙරේ. එය ඔබගේ පිළිතුරුවලින් වෙන්ව ගබඩා කර, ' +
    'දත්ත රැස්කිරීම අවසන් වූ පසු මකා දමනු ලැබේ.',
  'onboarding.emailPlaceholder': 'you@example.com',
  'onboarding.emailRequired': 'කරුණාකර ඔබගේ විද්‍යුත් තැපැල් ලිපිනය ඇතුළත් කරන්න.',
  'onboarding.emailInvalid': 'කරුණාකර වලංගු විද්‍යුත් තැපැල් ලිපිනයක් ඇතුළත් කරන්න.',

  'onboarding.ex1': 'ඔබ කොපමණ කාලයක සිට අන්තර්ජාලය හරහා සාප්පු සවාරි යනවාද?',
  'ex1.1': 'වසරකට අඩු',
  'ex1.2': 'වසර 1\u20132',
  'ex1.3': 'වසර 3\u20135',
  'ex1.4': 'වසර 6\u20139',
  'ex1.5': 'වසර 10 හෝ වැඩි',

  'onboarding.ex2': 'ඔබ කෙතරම් නිතර අන්තර්ජාලය හරහා මිලදී ගැනීම් කරනවාද?',
  'ex2.1': 'කලාතුරකින්, වසරකට වාර කිහිපයක්',
  'ex2.2': 'මාස කිහිපයකට වරක්',
  'ex2.3': 'මාසිකව',
  'ex2.4': 'සතිපතා',
  'ex2.5': 'සතියකට වාර කිහිපයක්',

  /* ---------------- Stage 3: calibration ---------------- */

  'calibration.title': 'වර්ණ මනාපයන්',
  'calibration.likedSubtitle': 'වැඩියෙන්ම කැමති වර්ණය',
  'calibration.dislikedSubtitle': 'අඩුවෙන්ම කැමති වර්ණය',

  /* "Now let's pick your most liked colour." / "Most liked colour locked." / "Now let's
     pick your least liked colour." Screens that separate the two identical palettes. */
  'calibration.introLikedTitle': 'දැන් ඔබ වැඩියෙන්ම කැමති වර්ණය තෝරා ගනිමු.',
  'calibration.introDislikedTitle': 'වැඩියෙන්ම කැමති වර්ණය අගුළු දමා ඇත.',
  'calibration.introDislikedBody': 'දැන් ඔබ අඩුවෙන්ම කැමති වර්ණය තෝරා ගනිමු.',

  /* "Your two colours" */
  'calibration.summaryTitle': 'ඔබ තෝරාගත් වර්ණ දෙක',
  /* "(One of these two colours will be randomly chosen for your T-shirt)". A statement
     about the design, read immediately before the ownership and control measures, so
     it should stay as neutral in Sinhala as it is in English. */
  'calibration.summaryNote':
    '(මෙම වර්ණ දෙකෙන් එකක් ඔබගේ ටී-ෂර්ට් එක සඳහා අහඹු ලෙස තෝරා ගනු ලැබේ)',

  /* "casual T-shirt" is rendered as "everyday T-shirt". The direct equivalent of
     "casual", අනියම්, also carries a sense of irregular or illicit in Sinhala. */
  'calibration.likedPrompt':
    'පහත වර්ණ අතරින්, එදිනෙදා අඳින ටී-ෂර්ට් එකක දැකීමට ඔබ වැඩියෙන්ම කැමති වර්ණය තෝරන්න.',
  'calibration.dislikedPrompt':
    'දැන්, එදිනෙදා අඳින ටී-ෂර්ට් එකක දැකීමට ඔබ අඩුවෙන්ම කැමති වර්ණය තෝරන්න.',
  'calibration.hint': 'ඔබ තට්ටු කළ විට ඔබගේ තේරීම අගුළු වැටේ. ඉදිරියට යන තුරු එය වෙනස් කළ හැකිය.',

  /* This one sits inside a colour swatch and has very little room. If it wraps badly on
     a phone, a shorter word matters more than a literal one. */
  'calibration.locked': 'අගුළු දමා ඇත',
  'calibration.mostLiked': 'වැඩියෙන්ම කැමති',
  'calibration.leastLiked': 'අඩුවෙන්ම කැමති',

  'calibration.mostLikedInline': 'වැඩියෙන්ම කැමති',
  'calibration.leastLikedInline': 'අඩුවෙන්ම කැමති',
  'calibration.swatchLockedTitle': '{colour} ({role} වර්ණය ලෙස අගුළු දමා ඇත)',
  'calibration.swatchLockedAria': '{colour}, {role} වර්ණය ලෙස අගුළු දමා ඇත',

  /* ---------------- colour names ----------------
   *
   * Sinhala has no everyday single word for teal, and magenta is normally borrowed
   * rather than translated. Both are built as compounds or transliterations here so
   * that all ten stay distinguishable from one another, which matters more than any
   * one of them being the most natural word on its own. The last three are the closest
   * together in hue and are the most likely to need a reviewer's judgement. */
  'colour.red_orange': 'රතු-තැඹිලි',
  'colour.orange': 'තැඹිලි',
  'colour.yellow_gold': 'කහ-රන්වන්',
  'colour.green': 'කොළ',
  'colour.teal': 'නිල්-කොළ',
  'colour.blue': 'නිල්',
  'colour.blue_violet': 'නිල්-දම්',
  'colour.magenta': 'මැජෙන්ටා',
  'colour.pink_magenta': 'රෝස-මැජෙන්ටා',
  'colour.pink_red': 'රෝස-රතු',

  /* ---------------- Stage 3.5: loading and reveal ---------------- */

  'reveal.preparing': 'ඔබගේ ටී-ෂර්ට් එක සකසමින්\u2026',
  'reveal.preparingAria': 'සකසමින්',
  'reveal.failedTitle': 'ඔබගේ ටී-ෂර්ට් එක සකස් කළ නොහැකි විය',

  /* ---------------- Stage 4: treatment ----------------
   *
   * These two must stay matched in how much they encourage lingering, because the time
   * taken at this stage is measured for both groups and compared. */
  'stage4.lookHint': 'මොහොතක් මෙම ටී-ෂර්ට් එක දෙස බලා, පසුව {continueButton} ක්ලික් කරන්න.',
  'stage4.customiseHint':
    'මොහොතක් අභිරුචිකරණය කර, ඔබ සූදානම් වූ පසු {continueButton} ක්ලික් කරන්න.',
  'stage4.controlsUnavailable': 'අභිරුචිකරණ විකල්ප පූරණය කළ නොහැකි විය.',

  /* ---------------- Stage 5: questionnaire ---------------- */

  'questionnaire.title': 'අවසාන ප්‍රශ්න කිහිපයක්',
  'questionnaire.lede':
    'එක් එක් ප්‍රකාශය 1 (තදින් එකඟ නොවෙමි) සිට 7 (තදින් එකඟ වෙමි) දක්වා ශ්‍රේණිගත කරන්න. සියල්ලටම පිළිතුරු දිය යුතුය.',
  /* Was "තදින්", which is tightly or firmly in the physical sense and reads oddly as a
     degree of agreement. "සම්පූර්ණයෙන්ම" -- completely -- is how the ends of an
     agreement scale are normally put in Sinhala. That is a slight drift from
     "strongly" to "completely"; flag it for the reviewer rather than assume it. */
  'questionnaire.likertMin': 'සම්පූර්ණයෙන්ම එකඟ නොවෙමි',
  'questionnaire.likertMax': 'සම්පූර්ණයෙන්ම එකඟ වෙමි',
  'questionnaire.scaleGuide':
    'පහත සෑම ප්‍රකාශයක් සඳහාම, ඔබ සම්පූර්ණයෙන්ම එකඟ නොවන්නේ නම් {min} තෝරන්න, ඔබ සම්පූර්ණයෙන්ම එකඟ වන්නේ නම් {max} තෝරන්න. අතර ඇති අංක එකකින් අනෙකට යන පියවර වේ.',
  'questionnaire.rateRequired': 'කරුණාකර මෙම ප්‍රකාශය ශ්‍රේණිගත කරන්න.',
  'questionnaire.allRequired': 'ඉදිරිපත් කිරීමට පෙර කරුණාකර ප්‍රකාශ {count}ටම පිළිතුරු දෙන්න.',

  /* The validated scale. Needs back translation, not proofreading. */
  'item.pin1': 'අවස්ථාවක් ලැබුණහොත් මම මෙම ටී-ෂර්ට් එක මිලදී ගන්නෙමි.',
  'item.pin2': 'මම යම් අවස්ථාවක දී මෙම ටී-ෂර්ට් එක මිලදී ගැනීමට බොහෝ දුරට ඉඩ ඇත.',
  'item.pin3': 'මම දැන් දුටු ආකාරයෙන්ම මෙම ටී-ෂර්ට් එක මිලදී ගැනීමට මම කැමැත්තෙමි.',
  'item.po1': 'මෙය මගේම ටී-ෂර්ට් එකක් ලෙස මට දැනේ.',
  'item.po2': 'මෙම ටී-ෂර්ට් එක මගේ යැයි ප්‍රබල හැඟීමක් මට දැනේ.',
  'item.po3': 'මෙම ටී-ෂර්ට් එක මට අයිති දෙයක් ලෙස මට දැනේ.',
  'item.pa1': 'මෙම ටී-ෂර්ට් එක පෙනෙන ආකාරය මගේ පාලනය යටතේ තිබූ බවක් මට දැනුණි.',
  'item.cp1': 'මම මෙම ටී-ෂර්ට් එකේ වර්ණයට කැමතියි.',

  /* ---------------- terminal screens ---------------- */

  'message.duplicate':
    'ඔබ දැනටමත් මෙම අධ්‍යයනයට සහභාගී වී ඇති බව පෙනේ. ඔබගේ කාලය වෙන් කිරීම ගැන නැවතත් ස්තූතියි.',
  'message.studyFull': 'මෙම අධ්‍යයනය තවදුරටත් ප්‍රතිචාර භාර නොගනී. ඔබගේ උනන්දුව ගැන ස්තූතියි.',
  'message.thanks': 'සහභාගී වීම ගැන ස්තූතියි.',
  'message.declined': 'ඔබගේ කාලය වෙන් කිරීම ගැන ස්තූතියි. ඔබට දැන් මෙම කවුළුව වසා දැමිය හැකිය.',
  'message.genericError':
    'ඔබගේ ප්‍රතිචාරය සුරැකීමේදී යම් දෝෂයක් ඇති විය. කරුණාකර ඔබගේ සම්බන්ධතාවය පරීක්ෂා කර නැවත උත්සාහ කරන්න.',

  'terminal.recorded': 'ඔබගේ ප්‍රතිචාරය සටහන් කර ගන්නා ලදී. ඔබට දැන් මෙම කවුළුව වසා දැමිය හැකිය.',
  'terminal.alreadyRecorded': 'ඔබගේ ප්‍රතිචාරය දැනටමත් සටහන් කර ගෙන ඇත. ස්තූතියි.',
  'terminal.unreachableTitle': 'අධ්‍යයනයට සම්බන්ධ විය නොහැකි විය',
  'terminal.unreachableBody': 'කරුණාකර ඔබගේ සම්බන්ධතාවය පරීක්ෂා කර පිටුව නැවත පූරණය කරන්න.'
};
