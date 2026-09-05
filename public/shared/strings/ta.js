/* Tamil copy. NOT YET VERIFIED BY A NATIVE SPEAKER.
 *
 * Every string here was translated by an AI assistant and is awaiting review. The same
 * three groups need more than a read-through as in si.js:
 *
 *  - The eight `item.*` entries are a validated questionnaire. They need forward and
 *    back translation, not proofreading. If the Tamil reads stronger or weaker than
 *    the English, language becomes confounded with condition and level.
 *  - `consent.*` is an ethics document. Whatever wording is approved is the wording
 *    that must appear here, character for character.
 *  - The ten `colour.*` names must stay ten distinguishable names.
 *
 * Any key deleted or left as an empty string falls back to English on screen and is
 * listed by `npm run check`. */

export default {
  /* ---------------- shared ---------------- */

  'common.continue': 'தொடரவும்',
  'common.submit': 'சமர்ப்பிக்கவும்',
  'common.saving': 'சேமிக்கிறது\u2026',
  'common.starting': 'தொடங்குகிறது\u2026',
  'common.submitting': 'சமர்ப்பிக்கிறது\u2026',
  'common.loading': 'ஏற்றுகிறது\u2026',
  'common.tryAgain': 'மீண்டும் முயற்சிக்கவும்',
  'common.selectOption': 'தயவுசெய்து ஒரு விருப்பத்தைத் தேர்ந்தெடுக்கவும்.',
  'common.thankYou': 'நன்றி',

  /* Joins the two eligible birth-year ranges. Spaces are part of the string. */
  'common.rangeJoin': ' அல்லது ',

  /* "Step {current} of {total}", as a fraction rather than the literal construction. */
  'step.format': 'படி {current} / {total}',

  /* ---------------- Stage 1: consent ---------------- */

  'consent.title': 'தகவல் மற்றும் ஒப்புதல்',

  'consent.body':
    'இந்த ஆய்வு களனி பல்கலைக்கழகத்தில் BSc (Hons) பட்ட ஆய்வேட்டின் ஒரு பகுதியாக நடத்தப்படுகிறது. ' +
    'உங்கள் பங்கேற்பு முற்றிலும் தன்னார்வமானது; உலாவியை மூடுவதன் மூலம் எந்த நேரத்திலும் நீங்கள் ' +
    'விலகிக்கொள்ளலாம். அனைத்துப் பதில்களும் அநாமதேயமாக்கப்படும்; உங்கள் மின்னஞ்சல் முகவரி நகல் ' +
    'பதில்களைத் தவிர்ப்பதற்காக மட்டுமே சேகரிக்கப்பட்டு, உங்கள் பதில்களிலிருந்து தனியாகச் ' +
    'சேமிக்கப்பட்டு, தரவு சேகரிப்பு முடிந்ததும் அழிக்கப்படும். தனிப்பட்ட முறையில் அடையாளம் ' +
    'காணக்கூடிய எந்தத் தகவலும் இறுதி அறிக்கையில் இடம்பெறாது. \u2018{agreeButton}\u2019 என்பதைக் ' +
    'கிளிக் செய்வதன் மூலம், உங்களுக்கு 18 வயது அல்லது அதற்கு மேற்பட்டது என்பதையும், பங்கேற்க ' +
    'ஒப்புக்கொள்வதையும் நீங்கள் உறுதிப்படுத்துகிறீர்கள்.',

  'consent.checkbox':
    'மேற்கண்டவற்றை நான் படித்துப் புரிந்துகொண்டேன், எனக்கு 18 வயது அல்லது அதற்கு மேற்பட்டது, மேலும் பங்கேற்க நான் ஒப்புதல் அளிக்கிறேன்.',
  'consent.agree': 'நான் ஒப்புக்கொள்கிறேன், தொடர்கிறேன்',
  'consent.decline': 'நான் பங்கேற்க விரும்பவில்லை',
  'consent.confirmRequired': 'தொடர்வதற்கு மேற்கண்ட கூற்றை உறுதிப்படுத்தவும்.',

  /* ---------------- Stage 2: onboarding ---------------- */

  'onboarding.title': 'உங்களைப் பற்றி சில கேள்விகள்',
  'onboarding.lede': 'அனைத்துப் புலங்களும் அவசியம்.',

  'onboarding.birthYear': 'உங்கள் பிறந்த ஆண்டு என்ன?',
  'onboarding.birthYearPlaceholder': 'எ.கா. 1975',
  'onboarding.birthYearRequired': 'தயவுசெய்து உங்கள் பிறந்த ஆண்டைப் பதிவிடவும்.',
  'onboarding.birthYearFourDigits': 'தயவுசெய்து நான்கு இலக்க ஆண்டைப் பதிவிடவும்.',
  'onboarding.ineligible':
    'இந்த ஆய்வு தற்போது {ranges} ஆண்டுகளுக்கு இடையில் பிறந்தவர்களுக்கு மட்டுமே திறந்திருக்கிறது.',

  'onboarding.gender': 'உங்கள் பாலினம் என்ன?',
  'gender.Male': 'ஆண்',
  'gender.Female': 'பெண்',
  'gender.Prefer not to say': 'கூற விரும்பவில்லை',

  'onboarding.email': 'உங்கள் மின்னஞ்சல் முகவரி என்ன?',
  'onboarding.emailHint':
    'நகல் பதில்களைத் தவிர்ப்பதற்காக மட்டுமே பயன்படுத்தப்படுகிறது. இது உங்கள் பதில்களிலிருந்து ' +
    'தனியாகச் சேமிக்கப்பட்டு, தரவு சேகரிப்பு முடிந்ததும் அழிக்கப்படும்.',
  'onboarding.emailPlaceholder': 'you@example.com',
  'onboarding.emailRequired': 'தயவுசெய்து உங்கள் மின்னஞ்சல் முகவரியைப் பதிவிடவும்.',
  'onboarding.emailInvalid': 'தயவுசெய்து சரியான மின்னஞ்சல் முகவரியைப் பதிவிடவும்.',

  'onboarding.ex1': 'எவ்வளவு காலமாக நீங்கள் இணையத்தில் பொருட்கள் வாங்கி வருகிறீர்கள்?',
  'ex1.1': 'ஒரு வருடத்திற்கும் குறைவாக',
  'ex1.2': '1\u20132 வருடங்கள்',
  'ex1.3': '3\u20135 வருடங்கள்',
  'ex1.4': '6\u20139 வருடங்கள்',
  'ex1.5': '10 வருடங்கள் அல்லது அதற்கு மேல்',

  'onboarding.ex2': 'நீங்கள் எவ்வளவு அடிக்கடி இணையத்தில் பொருட்கள் வாங்குகிறீர்கள்?',
  'ex2.1': 'அரிதாக, வருடத்திற்கு சில முறை',
  'ex2.2': 'சில மாதங்களுக்கு ஒருமுறை',
  'ex2.3': 'மாதம் ஒருமுறை',
  'ex2.4': 'வாரம் ஒருமுறை',
  'ex2.5': 'வாரத்திற்கு பல முறை',

  /* ---------------- Stage 3: calibration ---------------- */

  'calibration.title': 'நிற விருப்பங்கள்',
  'calibration.likedSubtitle': 'மிகவும் விரும்பிய நிறம்',
  'calibration.dislikedSubtitle': 'மிகக் குறைவாக விரும்பிய நிறம்',

  /* "Now let's pick your most liked colour." / "Most liked colour locked." / "Now let's
     pick your least liked colour." Screens that separate the two identical palettes. */
  'calibration.introLikedTitle': 'இப்போது நீங்கள் மிகவும் விரும்பும் நிறத்தைத் தேர்ந்தெடுப்போம்.',
  'calibration.introDislikedTitle': 'மிகவும் விரும்பிய நிறம் பூட்டப்பட்டது.',
  'calibration.introDislikedBody': 'இப்போது நீங்கள் மிகக் குறைவாக விரும்பும் நிறத்தைத் தேர்ந்தெடுப்போம்.',

  /* "Your two colours" */
  'calibration.summaryTitle': 'நீங்கள் தேர்ந்தெடுத்த இரண்டு நிறங்கள்',
  /* "(One of these two colours will be randomly chosen for your T-shirt)". A statement
     about the design, read immediately before the ownership and control measures, so
     it should stay as neutral in Tamil as it is in English. */
  'calibration.summaryNote':
    '(இந்த இரண்டு நிறங்களில் ஒன்று உங்கள் டி-ஷர்ட்டுக்கு சீரற்ற முறையில் தேர்ந்தெடுக்கப்படும்)',

  /* "casual T-shirt" is rendered as "a T-shirt worn day to day", which carries the
     intended sense without borrowing the English word. */
  'calibration.likedPrompt':
    'கீழே உள்ள நிறங்களில், அன்றாடம் அணியும் டி-ஷர்ட்டில் நீங்கள் மிகவும் விரும்பும் நிறத்தைத் தேர்ந்தெடுக்கவும்.',
  'calibration.dislikedPrompt':
    'இப்போது, அன்றாடம் அணியும் டி-ஷர்ட்டில் நீங்கள் மிகக் குறைவாக விரும்பும் நிறத்தைத் தேர்ந்தெடுக்கவும்.',
  'calibration.hint': 'நீங்கள் தட்டியவுடன் உங்கள் தேர்வு பூட்டப்படும். தொடரும் வரை அதை மாற்றலாம்.',

  /* This one sits inside a colour swatch and has very little room. If it wraps badly on
     a phone, a shorter word matters more than a literal one. */
  'calibration.locked': 'பூட்டப்பட்டது',
  'calibration.mostLiked': 'மிகவும் விரும்பியது',
  'calibration.leastLiked': 'மிகக் குறைவாக விரும்பியது',

  'calibration.mostLikedInline': 'மிகவும் விரும்பிய',
  'calibration.leastLikedInline': 'மிகக் குறைவாக விரும்பிய',
  'calibration.swatchLockedTitle': '{colour} ({role} நிறமாகப் பூட்டப்பட்டது)',
  'calibration.swatchLockedAria': '{colour}, {role} நிறமாகப் பூட்டப்பட்டது',

  /* ---------------- colour names ----------------
   *
   * Tamil has no everyday single word for teal, and magenta is normally borrowed
   * rather than translated. Both are built as compounds or transliterations here so
   * that all ten stay distinguishable from one another. The last three are the closest
   * together in hue and are the most likely to need a reviewer's judgement. */
  'colour.red_orange': 'சிவப்பு-ஆரஞ்சு',
  'colour.orange': 'ஆரஞ்சு',
  'colour.yellow_gold': 'மஞ்சள்-பொன்',
  'colour.green': 'பச்சை',
  'colour.teal': 'நீலப்பச்சை',
  'colour.blue': 'நீலம்',
  'colour.blue_violet': 'நீல-ஊதா',
  'colour.magenta': 'மெஜந்தா',
  'colour.pink_magenta': 'இளஞ்சிவப்பு-மெஜந்தா',
  'colour.pink_red': 'இளஞ்சிவப்பு-சிவப்பு',

  /* ---------------- Stage 3.5: loading and reveal ---------------- */

  'reveal.preparing': 'உங்கள் டி-ஷர்ட் தயாராகிறது\u2026',
  'reveal.preparingAria': 'தயாராகிறது',
  'reveal.failedTitle': 'உங்கள் டி-ஷர்ட்டைத் தயாரிக்க முடியவில்லை',

  /* ---------------- Stage 4: treatment ----------------
   *
   * These two must stay matched in how much they encourage lingering, because the time
   * taken at this stage is measured for both groups and compared. */
  'stage4.lookHint':
    'சிறிது நேரம் இந்த டி-ஷர்ட்டைப் பாருங்கள், பிறகு {continueButton} என்பதைக் கிளிக் செய்யவும்.',
  'stage4.customiseHint':
    'சிறிது நேரம் தனிப்பயனாக்கி, நீங்கள் தயாரானதும் {continueButton} என்பதைக் கிளிக் செய்யவும்.',
  'stage4.controlsUnavailable': 'தனிப்பயனாக்க விருப்பங்களை ஏற்ற முடியவில்லை.',

  /* ---------------- Stage 5: questionnaire ---------------- */

  'questionnaire.title': 'இறுதியாக சில கேள்விகள்',
  'questionnaire.lede':
    'ஒவ்வொரு கூற்றையும் 1 (கடுமையாக உடன்படவில்லை) முதல் 7 (கடுமையாக உடன்படுகிறேன்) வரை மதிப்பிடவும். அனைத்திற்கும் பதிலளிக்க வேண்டும்.',
  'questionnaire.likertMin': 'கடுமையாக உடன்படவில்லை',
  'questionnaire.likertMax': 'கடுமையாக உடன்படுகிறேன்',
  'questionnaire.rateRequired': 'தயவுசெய்து இந்தக் கூற்றை மதிப்பிடவும்.',
  'questionnaire.allRequired': 'சமர்ப்பிக்கும் முன் {count} கூற்றுகள் அனைத்திற்கும் பதிலளிக்கவும்.',

  /* The validated scale. Needs back translation, not proofreading. */
  'item.pin1': 'வாய்ப்பு கிடைத்தால் நான் இந்த டி-ஷர்ட்டை வாங்குவேன்.',
  'item.pin2': 'எப்போதாவது ஒரு சமயம் நான் இந்த டி-ஷர்ட்டை வாங்கக்கூடும்.',
  'item.pin3': 'நான் இப்போது பார்த்த அதே நிலையில் இந்த டி-ஷர்ட்டை வாங்க நான் தயாராக இருக்கிறேன்.',
  'item.po1': 'இது என்னுடைய டி-ஷர்ட் போல எனக்குத் தோன்றுகிறது.',
  'item.po2': 'இந்த டி-ஷர்ட் என்னுடையது என்ற வலுவான உணர்வு எனக்கு ஏற்படுகிறது.',
  'item.po3': 'இந்த டி-ஷர்ட் எனக்குச் சொந்தமானது போல் தோன்றுகிறது.',
  'item.pa1': 'இந்த டி-ஷர்ட் எப்படித் தோன்றுகிறது என்பதை நான் கட்டுப்படுத்தியது போல் உணர்ந்தேன்.',
  'item.cp1': 'இந்த டி-ஷர்ட்டின் நிறம் எனக்குப் பிடித்திருக்கிறது.',

  /* ---------------- terminal screens ---------------- */

  'message.duplicate':
    'நீங்கள் ஏற்கனவே இந்த ஆய்வில் பங்கேற்றுள்ளதாகத் தெரிகிறது. உங்கள் நேரத்திற்கு மீண்டும் நன்றி.',
  'message.studyFull': 'இந்த ஆய்வு இனி பதில்களை ஏற்றுக்கொள்ளவில்லை. உங்கள் ஆர்வத்திற்கு நன்றி.',
  'message.thanks': 'பங்கேற்றமைக்கு நன்றி.',
  'message.declined': 'உங்கள் நேரத்திற்கு நன்றி. இப்போது இந்தச் சாளரத்தை மூடலாம்.',
  'message.genericError':
    'உங்கள் பதிலைச் சேமிப்பதில் சிக்கல் ஏற்பட்டது. உங்கள் இணைப்பைச் சரிபார்த்து மீண்டும் முயற்சிக்கவும்.',

  'terminal.recorded': 'உங்கள் பதில் பதிவு செய்யப்பட்டது. இப்போது இந்தச் சாளரத்தை மூடலாம்.',
  'terminal.alreadyRecorded': 'உங்கள் பதில் ஏற்கனவே பதிவு செய்யப்பட்டுள்ளது. நன்றி.',
  'terminal.unreachableTitle': 'ஆய்வை அணுக முடியவில்லை',
  'terminal.unreachableBody': 'உங்கள் இணைப்பைச் சரிபார்த்து பக்கத்தை மீண்டும் ஏற்றவும்.'
};
