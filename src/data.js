/* The Durable Object that owns the database connection.
 *
 * Two things put the data layer here rather than in the request handler.
 *
 * Connections. A Worker isolate is short-lived, so opening a MongoDB connection per
 * request means a TCP handshake, a TLS negotiation and an authentication round trip
 * every time -- Cloudflare measured roughly 2s that way against ~35ms once warm -- and
 * under load it exhausts the Atlas connection limit. A Durable Object is a single
 * addressable instance that survives between requests, so the client and its pool are
 * created once and reused. (The Atlas Data API used to be the answer to this; it was
 * retired in September 2025 along with the rest of Atlas App Services, which is why
 * the official driver over a TCP socket is now the supported path.)
 *
 * Atomicity. Assignment has to read the per-cell completed counts and write the chosen
 * cell with nothing interleaving between the two. A Durable Object processes one
 * request at a time, so routing every session through a single named instance makes
 * read-decide-write atomic with no locking of our own.
 *
 * The class is a thin shell: it builds a store, wraps it in StudyService and forwards.
 * All the study's rules live in study-service.js, which has no Cloudflare dependency
 * and is therefore the same code the dev server and the tests run. */

import { DurableObject } from 'cloudflare:workers';
import { MongoClient } from 'mongodb';

import { DurableObjectKv, KvStore, MongoStore } from './stores.js';
import { StudyService } from './study-service.js';

export class MongoConnection extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.env = env;
    this.client = null;
    this.servicePromise = null;
  }

  /* Built once and reused for the lifetime of the instance, which is the whole point
   * of putting the connection in a Durable Object. */
  service() {
    /* The fallback is deliberately not cached. An instance that was first touched before
       MONGODB_URI existed would otherwise keep serving Durable Object storage for its
       whole lifetime, so adding the secret would appear to have no effect and the health
       check would keep reporting the wrong backend until someone happened to redeploy.
       Rebuilding the fallback per call is cheap, and it means the switch to Atlas happens
       on the very next request after the secret lands. */
    if (!this.env.MONGODB_URI) {
      console.warn(
        'MONGODB_URI is not set: falling back to Durable Object storage. ' +
        'Fine for a local walkthrough, not for collecting real responses.'
      );
      return Promise.resolve(
        new StudyService(new KvStore(new DurableObjectKv(this.ctx.storage), 'durable-object-storage'))
      );
    }

    if (!this.servicePromise) {
      this.servicePromise = (async () => {
        this.client = new MongoClient(this.env.MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
        await this.client.connect();
        const store = new MongoStore(this.client.db(this.env.MONGODB_DB || 'chameleon_study'));
        await store.ensureIndexes();
        return new StudyService(store);
      })().catch((err) => {
        /* A failed connect must not be cached, or the instance stays poisoned until it
           is evicted and every later request fails against the same rejected promise. */
        this.servicePromise = null;
        throw err;
      });
    }
    return this.servicePromise;
  }

  /* Durable Object RPC surface. Each method is a pass-through, so the Worker can call
   * `stub.assign(id)` and reach exactly the same code the tests exercise directly.
   *
   * Every argument the service takes must be named here as well. A pass-through that
   * forgets one is not a type error and not a runtime error: the argument simply
   * arrives as undefined, the service applies its default and the request succeeds
   * looking entirely normal. This is invisible to the dev server, which holds a
   * StudyService directly and never crosses this boundary, so it only shows up in
   * production -- which is exactly how the session language was silently defaulting to
   * English for every participant. tools/self-check.mjs now compares the arity of each
   * method here against the service's. */

  async health() { return (await this.service()).health(); }
  async startSession(options) { return (await this.service()).startSession(options); }
  async resume(sessionId) { return (await this.service()).resume(sessionId); }

  async saveOnboarding(sessionId, answers, emailHash) {
    return (await this.service()).saveOnboarding(sessionId, answers, emailHash);
  }
  async saveCalibration(sessionId, liked, disliked) {
    return (await this.service()).saveCalibration(sessionId, liked, disliked);
  }
  async assign(sessionId) { return (await this.service()).assign(sessionId); }
  async controlsFor(sessionId) { return (await this.service()).controlsFor(sessionId); }
  async saveDraft(sessionId, draft) { return (await this.service()).saveDraft(sessionId, draft); }
  async saveStage4(sessionId, payload) { return (await this.service()).saveStage4(sessionId, payload); }
  async submit(sessionId, answers) { return (await this.service()).submit(sessionId, answers); }

  async cellCounts() { return (await this.service()).cellCounts(); }
  async cleanupAbandoned(days) { return (await this.service()).cleanupAbandoned(days); }
  async deleteParticipants() { return (await this.service()).deleteParticipants(); }
  async exportCompleted() { return (await this.service()).exportCompleted(); }
}
