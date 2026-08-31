/* Cloudflare Worker entry point.
 *
 * Wires the shared router to the Durable Object and to the static assets binding.
 * Everything of substance is elsewhere: the routes in router.js, the study's rules in
 * study-service.js, the design constants in study-design.js. */

import { createRouter } from './router.js';

export { MongoConnection } from './data.js';

/* One instance for the whole study. Assignment reads the per-cell counts and writes the
 * chosen cell, and a Durable Object handles one request at a time, so routing every
 * session through the same named instance is what stops two participants interleaving
 * between the read and the write. At 240 responses the throughput cost is irrelevant. */
const DO_NAME = 'study-singleton';

/* The Atlas cluster is in Asia-Pacific, and every request does a database round trip, so
 * the connection pool is asked for in the same part of the world. A Durable Object's
 * location is fixed the first time it is instantiated, not on each call, which is why
 * this is set before the first deployment rather than added later. */
const DO_LOCATION_HINT = 'apac';

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY'
};

export default {
  async fetch(request, env) {
    const handle = createRouter({
      env,
      service: () => env.MONGO.get(env.MONGO.idFromName(DO_NAME), {
        locationHint: DO_LOCATION_HINT
      }),

      /* Anything that is not an API route and not a static file is a deep link or a
         stale URL. The study is a single page, so hand back the entry point and let
         the client resume from its stored session rather than show a participant a
         404. */
      serveAsset: async (request, url) => {
        const asset = await env.ASSETS.fetch(new Request(new URL('/', url), request));
        const res = new Response(asset.body, asset);
        for (const [k, v] of Object.entries(SECURITY_HEADERS)) res.headers.set(k, v);
        return res;
      }
    });

    return handle(request);
  }
};
