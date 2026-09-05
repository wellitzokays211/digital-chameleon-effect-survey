/* Server-only copy, in three languages.
 *
 * Bundled into the Worker and never served as a file. This is the translation half of
 * the split that src/study-design.js already makes, and it exists for the same reason:
 * some of the words the participant reads would, on their own, tell them about parts of
 * the design they are not supposed to know.
 *
 *  - The reveal sentence has two endings, one per condition. A participant who could
 *    read both would know immediately which of the two they had been given.
 *  - The changes list differs by level. Holding all four items client-side would tell a
 *    Level 2 participant that a fourth thing exists somewhere.
 *  - The control labels are the sharpest case. `control.skinTone` is sent only to the
 *    Level 3 sessions entitled to that control; a Level 2 browser that contained the
 *    words for a control it was never given would defeat the whole arrangement in
 *    src/stage4-controls.js, which goes to some length to keep that code out of reach.
 *
 * Structured by control rather than flat, so buildControlBundle can hand a session the
 * strings for its own controls and nothing else. Adding a key to the wrong group is
 * how a leak would happen, so group membership is the thing to check in review.
 *
 * The Sinhala and Tamil here carry the same health warning as public/shared/strings:
 * translated by an AI assistant, awaiting native-speaker verification. */

import { DEFAULT_LANGUAGE, normaliseLanguage } from '../public/shared/languages.js';

const STRINGS = {
  en: {
    reveal: {
      stem: 'This T-shirt is in {colour}.',
      stemNoColour: 'This T-shirt is in this colour.',
      /* Matched in length and construction on purpose. The only difference a
         participant may perceive between the two conditions is which colour they were
         given, never how the sentence carrying it was written. */
      likedClause: '(The colour you told us you like the most)',
      dislikedClause: '(The colour you told us you like the least)'
    },
    customisation: {
      prompt: 'You can now customise this T-shirt.',
      cta: 'Start customising',
      changesHeading: 'Changes you can make:'
    },
    changes: {
      text: 'Add text',
      sleeve: 'Change the sleeve length',
      neck: 'Change the neck type',
      skinTone: "Change the model's skin tone to match yours"
    },
    control: {
      text: {
        label: 'Custom text',
        placeholder: 'Add text to the shirt',
        hint:
          'Click the field (or double-click the text on the shirt) for multi-line ' +
          'editing. Drag the box on the shirt to reposition.',
        fontSize: 'Font size',
        decrease: 'Decrease font size',
        increase: 'Increase font size',
        black: 'Black',
        white: 'White'
      },
      sleeve: {
        label: 'Sleeve length',
        sleeveless: 'Sleeveless',
        short: 'Short sleeve',
        long: 'Long sleeve'
      },
      neck: {
        label: 'Neckline',
        round: 'Round neck',
        v: 'V-neck'
      },
      skinTone: {
        label: 'Model tone',
        aria: 'Model skin tone',
        original: 'Original',
        lightest: 'Lightest',
        light: 'Light',
        medium: 'Medium',
        deep: 'Deep',
        darkest: 'Darkest'
      }
    }
  },

  si: {
    reveal: {
      stem: 'මෙම ටී-ෂර්ට් එක {colour} වර්ණයෙන් ඇත.',
      stemNoColour: 'මෙම ටී-ෂර්ට් එක මෙම වර්ණයෙන් ඇත.',
      likedClause: '(ඔබ වැඩියෙන්ම කැමති බව අපට කී වර්ණය)',
      dislikedClause: '(ඔබ අඩුවෙන්ම කැමති බව අපට කී වර්ණය)'
    },
    customisation: {
      prompt: 'දැන් ඔබට මෙම ටී-ෂර්ට් එක අභිරුචිකරණය කළ හැකිය.',
      cta: 'අභිරුචිකරණය අරඹන්න',
      changesHeading: 'ඔබට කළ හැකි වෙනස්කම්:'
    },
    changes: {
      text: 'පෙළ එක් කරන්න',
      sleeve: 'අත් දිග වෙනස් කරන්න',
      neck: 'බෙල්ලේ හැඩය වෙනස් කරන්න',
      /* "The person in the photograph", not "the model". Sinhala marks gender on that
         noun, and which model is shown follows the participant's own gender answer, so
         a gendered word would be wrong for roughly half of them. */
      skinTone: 'ඡායාරූපයේ සිටින පුද්ගලයාගේ සමේ වර්ණය ඔබගේ සමට ගැළපෙන ලෙස වෙනස් කරන්න'
    },
    control: {
      text: {
        label: 'අභිරුචි පෙළ',
        placeholder: 'ෂර්ට් එකට පෙළ එක් කරන්න',
        hint:
          'පේළි කිහිපයක් ලිවීමට මෙම කොටුව මත ක්ලික් කරන්න (හෝ ෂර්ට් එකේ ඇති පෙළ මත දෙවරක් ' +
          'ක්ලික් කරන්න). ස්ථානය වෙනස් කිරීමට ෂර්ට් එකේ ඇති කොටුව අදින්න.',
        fontSize: 'අකුරු ප්‍රමාණය',
        decrease: 'අකුරු ප්‍රමාණය අඩු කරන්න',
        increase: 'අකුරු ප්‍රමාණය වැඩි කරන්න',
        black: 'කළු',
        white: 'සුදු'
      },
      sleeve: {
        label: 'අත් දිග',
        sleeveless: 'අත් නැති',
        short: 'කොට අත්',
        long: 'දිග අත්'
      },
      neck: {
        label: 'බෙල්ලේ හැඩය',
        round: 'රවුම් බෙල්ල',
        v: 'V හැඩැති බෙල්ල'
      },
      skinTone: {
        label: 'සමේ වර්ණය',
        aria: 'ඡායාරූපයේ සිටින පුද්ගලයාගේ සමේ වර්ණය',
        original: 'මුල් තත්ත්වය',
        lightest: 'ඉතා ලා',
        light: 'ලා',
        medium: 'මධ්‍යම',
        deep: 'තද',
        darkest: 'ඉතා තද'
      }
    }
  },

  ta: {
    reveal: {
      stem: 'இந்த டி-ஷர்ட் {colour} நிறத்தில் உள்ளது.',
      stemNoColour: 'இந்த டி-ஷர்ட் இந்த நிறத்தில் உள்ளது.',
      likedClause: '(நீங்கள் மிகவும் விரும்புவதாகக் கூறிய நிறம்)',
      dislikedClause: '(நீங்கள் மிகக் குறைவாக விரும்புவதாகக் கூறிய நிறம்)'
    },
    customisation: {
      prompt: 'இப்போது நீங்கள் இந்த டி-ஷர்ட்டைத் தனிப்பயனாக்கலாம்.',
      cta: 'தனிப்பயனாக்கத் தொடங்கவும்',
      changesHeading: 'நீங்கள் செய்யக்கூடிய மாற்றங்கள்:'
    },
    changes: {
      text: 'உரையைச் சேர்க்கவும்',
      sleeve: 'கை நீளத்தை மாற்றவும்',
      neck: 'கழுத்து வகையை மாற்றவும்',
      /* "The person in the picture", for the same reason as the Sinhala. */
      skinTone: 'படத்தில் உள்ள நபரின் தோல் நிறத்தை உங்கள் நிறத்திற்கு ஏற்ப மாற்றவும்'
    },
    control: {
      text: {
        label: 'தனிப்பயன் உரை',
        placeholder: 'சட்டையில் உரையைச் சேர்க்கவும்',
        hint:
          'பல வரிகளில் திருத்த இந்தப் புலத்தைக் கிளிக் செய்யவும் (அல்லது சட்டையில் உள்ள உரையை ' +
          'இருமுறை கிளிக் செய்யவும்). இடத்தை மாற்ற சட்டையில் உள்ள பெட்டியை இழுக்கவும்.',
        fontSize: 'எழுத்து அளவு',
        decrease: 'எழுத்து அளவைக் குறைக்கவும்',
        increase: 'எழுத்து அளவை அதிகரிக்கவும்',
        black: 'கருப்பு',
        white: 'வெள்ளை'
      },
      sleeve: {
        label: 'கை நீளம்',
        sleeveless: 'கை இல்லாதது',
        short: 'குட்டைக் கை',
        long: 'நீளக் கை'
      },
      neck: {
        label: 'கழுத்துப் பகுதி',
        round: 'வட்டக் கழுத்து',
        v: 'V வடிவக் கழுத்து'
      },
      skinTone: {
        label: 'தோல் நிறம்',
        aria: 'படத்தில் உள்ள நபரின் தோல் நிறம்',
        original: 'அசல்',
        lightest: 'மிக வெளிர்',
        light: 'வெளிர்',
        medium: 'நடுத்தரம்',
        deep: 'அடர்',
        darkest: 'மிக அடர்'
      }
    }
  }
};

/* Fills any gap from English, one key at a time rather than one section at a time.
 *
 * Falling back whole sections would mean a half-finished Tamil control block reverting
 * every one of its labels to English the moment a single key was missing, which is a
 * worse screen than the mixed one and hides how much of the work is actually done. */
function resolve(section, language) {
  const base = STRINGS[DEFAULT_LANGUAGE][section];
  const override = STRINGS[normaliseLanguage(language)]?.[section] || {};
  const out = {};
  for (const [key, fallback] of Object.entries(base)) {
    const value = override[key];
    out[key] = typeof value === 'string' && value.trim() !== '' ? value : fallback;
  }
  return out;
}

export function revealStrings(language) {
  return resolve('reveal', language);
}

export function customisationStrings(language) {
  return resolve('customisation', language);
}

export function changeStrings(language) {
  return resolve('changes', language);
}

/* Only the named controls.
 *
 * The blinding boundary in string form: pass `['text', 'sleeve', 'neck']` and the
 * result has no skinTone key at all, so there is nothing for buildControlBundle to
 * serialise into a Level 2 participant's bundle even by accident. */
export function controlStrings(language, controlNames) {
  const base = STRINGS[DEFAULT_LANGUAGE].control;
  const override = STRINGS[normaliseLanguage(language)]?.control || {};
  const out = {};
  for (const name of controlNames) {
    if (!base[name]) continue;
    out[name] = {};
    for (const [key, fallback] of Object.entries(base[name])) {
      const value = override[name]?.[key];
      out[name][key] = typeof value === 'string' && value.trim() !== '' ? value : fallback;
    }
  }
  return out;
}

/* Exposed for the self-check, which walks the tree comparing each language against
 * English. Nothing in the request path should reach for this: the resolvers above are
 * the only way strings should leave this module, because they are what applies the
 * fallback and, in controlStrings, the level filter. */
export const ALL_SERVER_STRINGS = STRINGS;
