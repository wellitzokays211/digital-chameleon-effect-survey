/* Test an Atlas connection string without deploying.
 *
 * Uploading a secret and redeploying is a slow way to find out you mistyped a password,
 * and the Worker can only tell you that something failed. This connects with the same
 * driver the Worker uses and turns the driver's error into the specific thing to go and
 * fix in Atlas.
 *
 * The string is read from the environment, never from an argument, so it does not end up
 * in your shell history. It is never printed back except as a masked summary.
 *
 * Usage (PowerShell):
 *   $env:MONGODB_URI = "mongodb+srv://user:pass@cluster0.xxxxx.mongodb.net/"
 *   node tools/check-mongo.mjs
 *
 * Usage (bash):
 *   MONGODB_URI="mongodb+srv://..." node tools/check-mongo.mjs
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'chameleon_study';

if (!uri) {
  console.error('\n  MONGODB_URI is not set in this shell.\n');
  console.error('  PowerShell:  $env:MONGODB_URI = "mongodb+srv://..."');
  console.error('  bash:        MONGODB_URI="mongodb+srv://..." node tools/check-mongo.mjs\n');
  process.exit(1);
}

/* ---------------- static checks ----------------
 *
 * Most failures are visible in the string itself, and saying so before spending eight
 * seconds on a doomed connection attempt is faster and more specific than the driver's
 * own error. */

const problems = [];
const warnings = [];

if (!/^mongodb(\+srv)?:\/\//.test(uri)) {
  problems.push('Does not start with mongodb+srv:// — this is not a connection string.');
}
if (uri.includes('<') || uri.includes('>')) {
  problems.push('Still contains < or > — the angle brackets around <db_password> must go too, not just the words.');
}
if (/<db_password>|<password>/i.test(uri)) {
  problems.push('Still contains the <db_password> placeholder — replace it with the real password.');
}

const match = /^mongodb(?:\+srv)?:\/\/([^:@/]*)(?::([^@]*))?@([^/?]+)/.exec(uri);
if (!match) {
  problems.push('Could not find user:password@host — check the string was copied whole.');
} else {
  const [, user, password, host] = match;
  if (!user) problems.push('No username before the colon.');
  if (!password) problems.push('No password between the colon and the @.');

  /* These are the characters that terminate or re-delimit a URI. Unencoded, the driver
     silently reads a truncated password and Atlas rejects it as bad auth — which looks
     exactly like a wrong password and is the single most common cause of it. */
  if (password) {
    const reserved = [...new Set([...password].filter((c) => '@:/?#[]%'.includes(c)))];
    if (reserved.length) {
      problems.push(
        `Password contains ${reserved.map((c) => `"${c}"`).join(', ')}, which must be ` +
        'percent-encoded. Easiest fix: generate a password without these characters.'
      );
    }
  }

  if (!/mongodb\.net/.test(host)) {
    warnings.push(`Host "${host}" is not an Atlas mongodb.net address. Intentional?`);
  }

  console.log('\n  Parsed:');
  console.log(`    username  ${user || '(missing)'}`);
  console.log(`    password  ${password ? `${password.length} characters, hidden` : '(missing)'}`);
  console.log(`    host      ${host}`);
  console.log(`    database  ${dbName}`);
}

if (problems.length) {
  console.error('\n  Problems found in the string itself:\n');
  for (const p of problems) console.error(`    - ${p}`);
  console.error('\n  Not attempting a connection. Fix these first.\n');
  process.exit(1);
}
for (const w of warnings) console.log(`\n  Note: ${w}`);

/* ---------------- live connection ---------------- */

console.log('\n  Connecting…');

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });

try {
  await client.connect();
  await client.db(dbName).command({ ping: 1 });
  console.log('  Connected and authenticated.\n');

  /* A user with only read access authenticates fine and then fails on the first insert,
     which would happen to a real participant rather than here. The collection is dropped
     rather than just emptied: leaving an empty one behind in the study's own database is
     clutter that later looks like it means something. */
  const probe = client.db(dbName).collection('_writecheck');
  const inserted = await probe.insertOne({ at: new Date() });
  await probe.deleteOne({ _id: inserted.insertedId });
  await probe.drop().catch(() => {});
  console.log('  Write access confirmed (test collection created and dropped).\n');

  const names = (await client.db(dbName).listCollections().toArray()).map((c) => c.name);
  console.log(`  Collections in "${dbName}": ${names.length ? names.join(', ') : '(none yet — created on first write)'}`);
  console.log('\n  This string is good. Upload it with:');
  console.log('    npx wrangler secret put MONGODB_URI\n');
} catch (err) {
  const message = String(err?.message || err);
  console.error(`\n  Failed: ${message}\n`);

  /* The driver's messages are terse and the fix is never in them. */
  if (/bad auth|Authentication failed/i.test(message)) {
    console.error('  Atlas reached the cluster and rejected the credentials, so the network');
    console.error('  side is fine and only the username or password is wrong. Check, in order:\n');
    console.error('    1. The username matches Database Access exactly, including case.');
    console.error('    2. The password is the database user\'s password — not your Atlas');
    console.error('       account login, which is a different thing.');
    console.error('    3. The password has no unencoded @ : / ? # [ ] % characters.');
    console.error('    4. If unsure, go to Atlas → Database Access → Edit → Edit Password →');
    console.error('       Autogenerate, copy it, and paste it straight in.\n');
  } else if (/timed out|ETIMEDOUT|ENOTFOUND|querySrv/i.test(message)) {
    console.error('  The cluster could not be reached at all, which is a network or address');
    console.error('  problem rather than a credentials one:\n');
    console.error('    1. Atlas → Network Access must allow 0.0.0.0/0.');
    console.error('    2. A free cluster pauses after inactivity — resume it in Atlas.');
    console.error('    3. Check the host name was copied correctly.\n');
  } else if (/not authorized/i.test(message)) {
    console.error('  Authentication worked but the user lacks permission. Set the role to');
    console.error('  "Read and write to any database" in Atlas → Database Access.\n');
  }
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
