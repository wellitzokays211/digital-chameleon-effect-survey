/* The languages the study is offered in.
 *
 * Client-safe and deliberately tiny: it is imported by the browser, by the Worker and
 * by the export tool, so that the set of valid codes has exactly one definition. A
 * language that is not in this list is not a language the study accepts, whether it
 * arrives from a dropdown, a hand-written request or an old session document.
 *
 * The codes are ISO 639-1 because they go straight into the `lang` attribute on
 * <html>, which is what tells the browser to reach for a Sinhala or Tamil face when
 * Inter has no glyph for the character it is being asked to draw. Inventing our own
 * codes here would leave both scripts rendering as empty boxes. */

export const DEFAULT_LANGUAGE = 'en';

/* Each language is named in its own script, not in English.
 *
 * A participant who cannot read English cannot find "Sinhala" in a list, so labelling
 * the options in the language of the reader would defeat the only purpose the dropdown
 * has. The English name is kept alongside for the two non-English options so that the
 * researcher, a supervisor or an examiner looking over a participant's shoulder can
 * still tell which is selected. */
export const LANGUAGES = [
  { code: 'en', label: 'English', endonym: 'English' },
  { code: 'si', label: 'Sinhala', endonym: '\u0DC3\u0DD2\u0D82\u0DC4\u0DBD' },
  { code: 'ta', label: 'Tamil', endonym: '\u0BA4\u0BAE\u0BBF\u0BB4\u0BCD' }
];

export const LANGUAGE_CODES = LANGUAGES.map((l) => l.code);

export function isLanguage(code) {
  return typeof code === 'string' && LANGUAGE_CODES.includes(code);
}

/* Anything unrecognised becomes English rather than an error.
 *
 * Used on the read path, where the alternative is worse than a wrong language: a
 * session document written before this feature existed has no language field at all,
 * and a participant part-way through the study must not be turned away because of it. */
export function normaliseLanguage(code) {
  return isLanguage(code) ? code : DEFAULT_LANGUAGE;
}

/* The dropdown label, in all three scripts.
 *
 * The same problem as the option names, one level up: a control labelled only
 * "Language" is invisible to the participant who most needs it. Three words is short
 * enough to sit on one line and needs no translation review, being the bare noun in
 * each language rather than anything the study measures. */
export const LANGUAGE_FIELD_LABEL =
  'Language / \u0DB7\u0DCF\u0DC2\u0DCF\u0DC0 / \u0BAE\u0BCA\u0BB4\u0BBF';
