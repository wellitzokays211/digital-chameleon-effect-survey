/* Email hashing for duplicate control.
 *
 * The plaintext address never leaves this function and is never stored anywhere. What
 * goes into `participants` is a salted SHA-256 digest, which is enough to recognise a
 * returning participant and not enough to recover who they are.
 *
 * The salt is a secret pepper rather than a per-record salt, deliberately: duplicate
 * control needs to look an address up, which a per-record salt would make impossible.
 * A bare unsalted hash of an email is trivially reversible by dictionary attack, so
 * the pepper is what actually protects the address if the collection ever leaks. It
 * must stay constant for the whole of data collection -- rotating it silently
 * disables duplicate detection, because every stored digest becomes unmatchable. */

export async function hashEmail(email, salt) {
  if (!salt) throw new Error('EMAIL_HASH_SALT is not configured');

  /* Addresses are compared case-insensitively and without surrounding whitespace,
     which is how a participant retyping their own address will differ. No further
     canonicalisation: stripping dots or +tags would silently merge addresses that
     some providers treat as distinct, and wrongly turn a genuine participant away. */
  const normalised = String(email).trim().toLowerCase();

  const bytes = new TextEncoder().encode(salt + '\u0000' + normalised);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
