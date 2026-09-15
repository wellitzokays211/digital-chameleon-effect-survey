/* Plain-Node development server.
 *
 * Runs the study on Node alone: no Workers runtime, no Durable Objects, no Atlas, no
 * admin rights. It mounts the same router and the same StudyService the deployed
 * Worker uses, over an in-memory store, and serves public/ as static files. So what
 * you exercise here is the real request handling and the real experimental logic --
 * only the storage and the hosting differ.
 *
 * Two things it deliberately does not reproduce:
 *
 *  - Durability. State lives in memory and is gone when the process exits.
 *  - The Durable Object's single-threaded guarantee. Node handles requests
 *    concurrently, so the read-decide-write in assignment is not atomic here the way
 *    it is in production. It does not matter for a walkthrough, and it is why the
 *    deployed version routes everything through one Durable Object.
 *
 * Usage:  node tools/dev-server.mjs [port]
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

import { createRouter } from '../src/router.js';
import { previewPage } from '../src/preview-page.js';
import { StudyService } from '../src/study-service.js';
import { KvStore, MemoryKv } from '../src/stores.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..');
const publicDir = path.join(projectRoot, 'public');

const PORT = Number(process.argv[2]) || 8787;

/* Loaded from .dev.vars if it is there, so the dev server and Wrangler read their
 * configuration from the same file rather than drifting apart. */
async function loadDevVars() {
  const vars = {};
  try {
    const text = await readFile(path.join(projectRoot, '.dev.vars'), 'utf8');
    for (const line of text.split('\n')) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (!match) continue;
      vars[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  } catch { /* fall back to the defaults below */ }

  return {
    EMAIL_HASH_SALT: vars.EMAIL_HASH_SALT || 'dev-salt',
    ADMIN_TOKEN: vars.ADMIN_TOKEN || 'dev-admin-token',
    MONGODB_DB: vars.MONGODB_DB || 'chameleon_study'
  };
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2'
};

async function serveAsset(request, url) {
  /* Resolved and then confirmed to be inside public/, so a crafted path cannot walk
     out of the served directory. */
  const requested = decodeURIComponent(url.pathname) === '/' ? '/index.html' : decodeURIComponent(url.pathname);

  /* /preview is the router's now, because the deployed Worker serves it too -- behind a
     token there, open here. This server only still answers /preview.html, for the older
     URL. The page itself lives in src/preview-page.js rather than in public/, since
     public/ is uploaded to Cloudflare and served with no gate in front of it. */
  if (requested === '/preview.html') {
    return new Response(previewPage(), {
      headers: { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' }
    });
  }

  const resolved = path.resolve(publicDir, '.' + requested);

  if (!resolved.startsWith(publicDir)) {
    return new Response('forbidden', { status: 403 });
  }

  try {
    const info = await stat(resolved);
    if (info.isDirectory()) throw new Error('directory');
    const body = await readFile(resolved);
    return new Response(body, {
      headers: {
        'Content-Type': MIME[path.extname(resolved).toLowerCase()] || 'application/octet-stream',
        /* No caching in development, so an edited file is always the one you get. */
        'Cache-Control': 'no-store'
      }
    });
  } catch {
    /* Unknown paths fall back to the entry point: the study is a single page, and a
       deep link should resume rather than 404. */
    try {
      const body = await readFile(path.join(publicDir, 'index.html'));
      return new Response(body, {
        status: 200,
        headers: { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' }
      });
    } catch {
      return new Response('public/index.html is missing', { status: 500 });
    }
  }
}

async function main() {
  const env = await loadDevVars();
  const service = new StudyService(new KvStore(new MemoryKv(), 'in-memory (dev server)'));
  /* The one behavioural difference from the deployed Worker. src/index.js does not pass
     this, so the preview route exists on this server and nowhere else. */
  const handle = createRouter({ service, env, serveAsset, preview: true });

  const server = createServer(async (req, res) => {
    const url = 'http://' + (req.headers.host || `127.0.0.1:${PORT}`) + req.url;

    /* Node's IncomingMessage translated into a Fetch Request, which is what the shared
       router expects. A body is only read for methods that can carry one. */
    let body;
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      body = Buffer.concat(chunks);
      if (!body.length) body = undefined;
    }

    let response;
    try {
      response = await handle(new Request(url, { method: req.method, headers: req.headers, body }));
    } catch (err) {
      console.error('dev server error:', err);
      response = new Response(JSON.stringify({ error: 'internal error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    res.statusCode = response.status;
    for (const [key, value] of response.headers) res.setHeader(key, value);
    res.end(Buffer.from(await response.arrayBuffer()));
  });

  server.listen(PORT, '127.0.0.1', () => {
    console.log(`
  Study running at  http://127.0.0.1:${PORT}
  Preview any cell  http://127.0.0.1:${PORT}/preview   (development only)

  Storage:  in-memory, cleared when this process stops
  Admin:    curl -H "Authorization: Bearer ${env.ADMIN_TOKEN}" http://127.0.0.1:${PORT}/api/admin/counts

  Ctrl+C to stop.
`);
  });
}

main();
