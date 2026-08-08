// Pull Kolekce Parchant's schedule from GoOut and cache it to data/goout.json.
//
// The endpoint is undocumented and evolving (some response fields already carry
// @DEPRECATED markers), so this never overwrites a good cache with a bad fetch.
// If GoOut changes or goes away, the site keeps rendering the last known dates.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'data', 'goout.json');

const PERFORMER_ID = 2590315; // Kolekce Parchant
const SOURCE = 'parchant.cz'; // GoOut returns 401 without a source domain
const ARCHIVE_FROM = '2019-01-01';
const ARCHIVE_TO = '2030-01-01';

const ENDPOINT = 'https://goout.net/services/feeder/v1/events.json';

function buildUrl() {
  const params = new URLSearchParams({
    performer: String(PERFORMER_ID),
    source: SOURCE,
    after: ARCHIVE_FROM,
    before: ARCHIVE_TO,
    limit: '200',
  });
  return `${ENDPOINT}?${params}`;
}

// GoOut returns parallel lookup tables; flatten them into one row per date.
function normalize(payload) {
  const events = payload.events ?? {};
  const venues = payload.venues ?? {};
  const schedule = payload.schedule ?? [];

  const productions = Object.values(events).map((event) => ({
    gooutEventId: event.id,
    title: event.name,
    url: event.url,
    images: (event.images ?? []).map((image) => image.src),
  }));

  const dates = schedule
    .map((row) => {
      const venue = venues[row.venueId];
      return {
        gooutEventId: row.eventId,
        start: row.startISO8601,
        cancelled: Boolean(row.cancelled),
        ticketingState: row.ticketingState,
        ticketUrl: row.url,
        venue: venue ? { name: venue.name, address: venue.address, city: venue.city } : null,
      };
    })
    .sort((a, b) => a.start.localeCompare(b.start));

  return { productions, dates };
}

async function readCache() {
  try {
    return JSON.parse(await readFile(CACHE, 'utf8'));
  } catch {
    return null;
  }
}

async function main() {
  const cached = await readCache();

  let fresh;
  try {
    const response = await fetch(buildUrl());
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    if (payload.status !== 200) throw new Error(`GoOut status ${payload.status}: ${payload.message}`);

    fresh = normalize(payload);
    if (fresh.dates.length === 0) throw new Error('feed returned no dates');
  } catch (error) {
    if (!cached) {
      console.error(`GoOut fetch failed and no cache exists: ${error.message}`);
      process.exit(1);
    }
    console.error(`GoOut fetch failed (${error.message}) - keeping cache from ${cached.fetchedAt}`);
    return;
  }

  const output = {
    fetchedAt: new Date().toISOString(),
    performerId: PERFORMER_ID,
    performerUrl: 'https://goout.net/en/kolekce-parchant/pzpmtpg/',
    ...fresh,
  };

  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, `${JSON.stringify(output, null, 2)}\n`);

  const upcoming = fresh.dates.filter((date) => date.start > new Date().toISOString());
  console.log(
    `Cached ${fresh.productions.length} productions, ${fresh.dates.length} dates ` +
      `(${upcoming.length} upcoming) to data/goout.json`
  );
}

main();
