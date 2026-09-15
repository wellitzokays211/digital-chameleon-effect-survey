/* Storage backends.
 *
 * Three of them behind one interface, so the study logic never knows which it is
 * talking to:
 *
 *  - MongoStore is the real one, used in production.
 *  - KvStore over DurableObjectKv is the Worker's no-database fallback.
 *  - KvStore over MemoryKv backs the plain-Node dev server and the test suite.
 *
 * The point of the last two is that the whole participant journey, including
 * randomisation and resume, can be exercised without a database and without the
 * Workers runtime. None of them is a substitute for Atlas when collecting real
 * responses. */

const now = () => new Date();

/* ---------------- MongoDB ----------------
 *
 * Takes an already-connected `db`, so this module has no driver dependency and stays
 * importable from plain Node. */

export class MongoStore {
  constructor(db) {
    this.responses = db.collection('responses');
    this.participants = db.collection('participants');
  }

  get backend() { return 'mongodb'; }

  /* Unique on sessionId so a retried upsert cannot produce two documents for one
   * participant; unique on emailHash so duplicate control cannot be defeated by two
   * requests arriving at the same moment. */
  async ensureIndexes() {
    await Promise.all([
      this.responses.createIndex({ sessionId: 1 }, { unique: true }),
      this.responses.createIndex({ completed: 1, cellId: 1 }),
      this.responses.createIndex({ completed: 1, lastUpdatedAt: 1 }),
      this.participants.createIndex({ emailHash: 1 }, { unique: true })
    ]);
  }

  findSession(sessionId) {
    return this.responses.findOne({ sessionId }, { projection: { _id: 0 } });
  }

  async upsertSession(sessionId, patch) {
    await this.responses.updateOne(
      { sessionId },
      { $set: { ...patch, lastUpdatedAt: now() } },
      { upsert: true }
    );
  }

  async insertSession(doc) {
    await this.responses.insertOne({ ...doc });
  }

  /* `isPreview: { $ne: true }` rather than `isPreview: false`, because documents written
     before the field existed do not carry it at all and `$ne` matches a missing field
     while an equality test would drop every one of them. */
  async completedCountsByCell() {
    const rows = await this.responses
      .aggregate([
        { $match: { completed: true, isPreview: { $ne: true } } },
        { $group: { _id: '$cellId', n: { $sum: 1 } } }
      ])
      .toArray();
    const counts = {};
    for (const row of rows) if (row._id != null) counts[row._id] = row.n;
    return counts;
  }

  async emailExists(emailHash) {
    return Boolean(await this.participants.findOne({ emailHash }, { projection: { _id: 1 } }));
  }

  async addEmail(emailHash) {
    try {
      await this.participants.insertOne({ emailHash, createdAt: now() });
      return true;
    } catch (err) {
      /* A duplicate key here means a concurrent request registered the same address
         between the check and the insert, which is exactly what the unique index is
         for. Treat it as the duplicate it is rather than an error. */
      if (err && err.code === 11000) return false;
      throw err;
    }
  }

  async deleteAllEmails() {
    const { deletedCount } = await this.participants.deleteMany({});
    return deletedCount || 0;
  }

  async deleteAbandoned(cutoff) {
    const { deletedCount } = await this.responses.deleteMany({
      completed: false,
      lastUpdatedAt: { $lt: cutoff }
    });
    return deletedCount || 0;
  }

  listCompleted() {
    return this.responses
      .find({ completed: true, isPreview: { $ne: true } }, { projection: { _id: 0 } })
      .toArray();
  }
}

/* ---------------- key-value adapters ---------------- */

export class MemoryKv {
  #map = new Map();

  async get(key) {
    return this.#map.get(key) ?? null;
  }
  async put(key, value) {
    /* Cloned on write so a caller holding a reference cannot mutate stored state
       behind the store's back, which is how an in-memory fake quietly stops
       behaving like a database. */
    this.#map.set(key, structuredClone(value));
  }
  async delete(keys) {
    for (const key of [].concat(keys)) this.#map.delete(key);
  }
  async list({ prefix }) {
    const out = new Map();
    for (const [key, value] of this.#map) if (key.startsWith(prefix)) out.set(key, value);
    return out;
  }
}

export class DurableObjectKv {
  constructor(storage) {
    this.storage = storage;
  }
  async get(key) {
    return (await this.storage.get(key)) ?? null;
  }
  async put(key, value) {
    await this.storage.put(key, value);
  }
  async delete(keys) {
    await this.storage.delete([].concat(keys));
  }
  async list(options) {
    return this.storage.list(options);
  }
}

/* ---------------- key-value store ---------------- */

export class KvStore {
  constructor(kv, backend = 'key-value') {
    this.kv = kv;
    this.backendName = backend;
  }

  get backend() { return this.backendName; }

  async ensureIndexes() { /* nothing to build */ }

  findSession(sessionId) {
    return this.kv.get('s:' + sessionId);
  }

  async upsertSession(sessionId, patch) {
    const existing = (await this.kv.get('s:' + sessionId)) || { sessionId };
    await this.kv.put('s:' + sessionId, { ...existing, ...patch, lastUpdatedAt: now() });
  }

  async insertSession(doc) {
    await this.kv.put('s:' + doc.sessionId, doc);
  }

  async #allSessions() {
    const map = await this.kv.list({ prefix: 's:' });
    return [...map.values()];
  }

  /* Same exclusion as the Mongo store, and for the same reason: a cell demonstrated
     through the preview must not consume a slot against its target. */
  async completedCountsByCell() {
    const counts = {};
    for (const doc of await this.#allSessions()) {
      if (doc.isPreview === true) continue;
      if (doc.completed && doc.cellId != null) counts[doc.cellId] = (counts[doc.cellId] || 0) + 1;
    }
    return counts;
  }

  async emailExists(emailHash) {
    return (await this.kv.get('e:' + emailHash)) != null;
  }

  async addEmail(emailHash) {
    if (await this.emailExists(emailHash)) return false;
    await this.kv.put('e:' + emailHash, { createdAt: now() });
    return true;
  }

  async deleteAllEmails() {
    const map = await this.kv.list({ prefix: 'e:' });
    const keys = [...map.keys()];
    if (keys.length) await this.kv.delete(keys);
    return keys.length;
  }

  async deleteAbandoned(cutoff) {
    const doomed = [];
    for (const doc of await this.#allSessions()) {
      if (!doc.completed && new Date(doc.lastUpdatedAt) < cutoff) doomed.push('s:' + doc.sessionId);
    }
    if (doomed.length) await this.kv.delete(doomed);
    return doomed.length;
  }

  async listCompleted() {
    return (await this.#allSessions()).filter((doc) => doc.completed && doc.isPreview !== true);
  }
}
