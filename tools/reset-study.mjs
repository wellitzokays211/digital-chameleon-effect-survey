/* Empty the study's collections.
 *
 * For clearing the sessions the self-check writes, before real collection begins. There
 * is deliberately no admin endpoint that does this: an HTTP route capable of deleting
 * completed responses is a route capable of destroying the dataset, and no participant
 * flow needs one. Doing it here means it takes the database password, which only you
 * have.
 *
 * It refuses to delete anything unless --yes is passed, so the default behaviour is to
 * report what is there and stop.
 *
 * Usage (PowerShell):
 *   $env:MONGODB_URI = "mongodb+srv://..."
 *   node tools/reset-study.mjs           # show what is there, delete nothing
 *   node tools/reset-study.mjs --yes     # actually delete it
 */

import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'chameleon_study';
const confirmed = process.argv.includes('--yes');

if (!uri) {
  console.error('\n  MONGODB_URI is not set in this shell.');
  console.error('  PowerShell:  $env:MONGODB_URI = "mongodb+srv://..."\n');
  process.exit(1);
}

const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });

try {
  await client.connect();
  const db = client.db(dbName);

  const responses = db.collection('responses');
  const participants = db.collection('participants');

  const total = await responses.countDocuments();
  const completed = await responses.countDocuments({ completed: true });
  const emails = await participants.countDocuments();

  console.log(`\n  Database: ${dbName}\n`);
  console.log(`    responses      ${total} documents, of which ${completed} completed`);
  console.log(`    participants   ${emails} email hashes`);

  if (total === 0 && emails === 0) {
    console.log('\n  Already empty. Nothing to do.\n');
    process.exit(0);
  }

  if (!confirmed) {
    console.log('\n  Nothing deleted. To delete all of the above:\n');
    console.log('    node tools/reset-study.mjs --yes\n');
    /* Said plainly, because the number above is the only thing standing between a
       mistyped command and a lost dataset. */
    if (completed > 0) {
      console.log(`  Note: ${completed} completed response(s) would be destroyed. If this is`);
      console.log('  real participant data, export it first:\n');
      console.log('    curl -H "Authorization: Bearer $ADMIN_TOKEN" <your-url>/api/admin/export > backup.json\n');
    }
    process.exit(0);
  }

  const deletedResponses = await responses.deleteMany({});
  const deletedEmails = await participants.deleteMany({});

  console.log('\n  Deleted:');
  console.log(`    responses      ${deletedResponses.deletedCount}`);
  console.log(`    participants   ${deletedEmails.deletedCount}`);

  const stillThere = await responses.countDocuments();
  console.log(`\n  responses now holds ${stillThere} documents.`);
  console.log('  The collections and their indexes remain; only the documents are gone.\n');
} catch (err) {
  console.error(`\n  Failed: ${err?.message || err}\n`);
  process.exitCode = 1;
} finally {
  await client.close().catch(() => {});
}
