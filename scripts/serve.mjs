// Dependency-free static server for the built site.
//
// The site's links are root-relative (no base path until a host is chosen),
// so file:// cannot follow them between pages. Both the check suite and local
// preview go over HTTP instead.
//
//   node scripts/serve.mjs [dir] [port]     # preview: default dist, 4173
//
// check.mjs imports staticServer() and picks its own port.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

export function staticServer(rootDir) {
  const root = resolve(rootDir);

  return createServer(async (request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    // A directory URL without the trailing slash still resolves, matching how
    // real static hosts redirect; no extension means it can't be a file.
    else if (!extname(pathname)) pathname += '/index.html';

    const file = resolve(join(root, pathname));
    // join() already collapses ../ segments; this guard refuses anything that
    // escaped the root anyway.
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }

    try {
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('not found');
    }
  });
}

// Run directly: serve for preview.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const dir = process.argv[2] ?? 'dist';
  const port = Number(process.argv[3] ?? 4173);
  staticServer(dir).listen(port, () => {
    console.log(`serving ${dir}/ at http://127.0.0.1:${port}/`);
  });
}
