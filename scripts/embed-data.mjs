// Embed the cached GoOut dates directly into the prototype between markers.
// The page must work from file:// and from a single inlined build, so it cannot
// fetch its data at runtime.

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'data', 'goout.json');
const TARGETS = [join(ROOT, 'prototype', 'canvas.html')];

const START = '/* GOOUT:START */';
const END = '/* GOOUT:END */';

const cache = JSON.parse(await readFile(CACHE, 'utf8'));

// Only what the page renders. Keeps the embedded payload small.
const payload = {
  fetchedAt: cache.fetchedAt,
  dates: cache.dates.map((date) => ({
    gooutEventId: date.gooutEventId,
    start: date.start,
    cancelled: date.cancelled,
    ticketingState: date.ticketingState,
    ticketUrl: date.ticketUrl,
    venue: date.venue ? { name: date.venue.name } : null,
  })),
};

for (const target of TARGETS) {
  const html = await readFile(target, 'utf8');
  const from = html.indexOf(START);
  const to = html.indexOf(END);
  if (from === -1 || to === -1) throw new Error(`Markers not found in ${target}`);

  const next =
    html.slice(0, from + START.length) + '\n' + JSON.stringify(payload) + '\n' + html.slice(to);
  await writeFile(target, next);
  console.log(`Embedded ${payload.dates.length} dates into ${target.replace(ROOT + '/', '')}`);
}
