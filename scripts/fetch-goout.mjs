// Pull Kolekce Parchant's schedule from GoOut and cache it to data/goout.json.
//
// The endpoint is undocumented and evolving (some response fields already carry
// @DEPRECATED markers), so this never overwrites a good cache with a bad fetch.
// If GoOut changes or goes away, the site keeps rendering the last known dates.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { titlesAgree } from '../src/lib/program.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = join(ROOT, 'data', 'goout.json');

const PERFORMER_ID = 2590315; // Kolekce Parchant
// Studio Citadela, where they play. Queried alongside the performer because
// the performer query alone MISSES DATES: measured 2026-09-09, the Rychlé šípy
// event (3345388) carries performerIds [], so it is attached to no performer
// at all and never appears under 2590315 - while Hra lásky a náhody carries
// [2590315] and does. The real fix is theirs, not ours: attaching the
// performer to that event in their GoOut account would also put it back on
// their own performer page, where it is currently invisible. Until they do,
// the venue is the only way to see it.
const VENUE_ID = 4025; // Studio Citadela
const SOURCE = 'parchant.cz'; // GoOut returns 401 without a source domain
const ARCHIVE_FROM = '2019-01-01';
const ARCHIVE_TO = '2030-01-01';

const ENDPOINT = 'https://goout.net/services/feeder/v1/events.json';

// GoOut clamps `limit` to 100 whatever you ask for, and answers oldest first,
// so a single page of an archive query returns the OLDEST hundred and hides
// everything upcoming behind hasNext. Asking for 200 and reading page 1 is
// what made the venue query look like it had no future dates at all. Pages are
// followed until hasNext goes false; the cap is a stop against a feed that
// never says so.
const PAGE_SIZE = 100;
const MAX_PAGES = 50;

function buildUrl(scope, page) {
  const params = new URLSearchParams({
    ...scope,
    source: SOURCE,
    after: ARCHIVE_FROM,
    before: ARCHIVE_TO,
    limit: String(PAGE_SIZE),
    page: String(page),
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
    // Whether GoOut itself says this is theirs. False means the event is
    // attached to no performer, so the only thing tying it to the company is
    // that it plays at their venue - which is also true of other companies'
    // work there. withTickets() never trusts this alone: it needs the date and
    // the title to agree as well before it will mint a link.
    attributed: (event.performerIds ?? []).includes(PERFORMER_ID),
    images: (event.images ?? []).map((image) => image.src),
  }));

  const dates = schedule
    .map((row) => {
      const venue = venues[row.venueId];
      return {
        scheduleId: row.id,
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

async function fetchPage(scope, page) {
  const response = await fetch(buildUrl(scope, page));
  if (!response.ok) throw new Error(`HTTP ${response.status}`);

  const payload = await response.json();
  if (payload.status !== 200) throw new Error(`GoOut status ${payload.status}: ${payload.message}`);

  return payload;
}

async function fetchScope(scope) {
  const pages = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const payload = await fetchPage(scope, page);
    pages.push(normalize(payload));
    if (!payload.hasNext) return merge(pages);
  }
  throw new Error(`${JSON.stringify(scope)} still had more pages after ${MAX_PAGES}`);
}

// The two queries overlap - Hra lásky a náhody comes back from both - so they
// are merged on the ids GoOut itself gives, not on anything derived. A
// production seen as attributed by either query stays attributed.
function merge(results) {
  const productions = new Map();
  for (const production of results.flatMap((r) => r.productions)) {
    const seen = productions.get(production.gooutEventId);
    productions.set(production.gooutEventId, seen
      ? { ...seen, attributed: seen.attributed || production.attributed }
      : production);
  }

  const dates = new Map();
  for (const date of results.flatMap((r) => r.dates)) dates.set(date.scheduleId, date);

  return {
    productions: [...productions.values()],
    dates: [...dates.values()].sort((a, b) => a.start.localeCompare(b.start)),
  };
}

// Studio Citadela is a venue, not the company: querying it returns every
// company that has ever played there - 51 productions and 102 dates when this
// was first run against the archive. So a venue row is kept only when GoOut
// attributes it to the performer, or when it matches something the company
// actually plays. Their own programme is the whitelist, which means adding a
// production to data/program.json is all it takes for its GoOut dates to
// become visible here.
function keep(production, ourTitles) {
  return production.attributed || ourTitles.some((title) => titlesAgree(title, production.title));
}

function ours(fresh, ourTitles) {
  const productions = fresh.productions.filter((production) => keep(production, ourTitles));
  const ids = new Set(productions.map((production) => production.gooutEventId));
  return { productions, dates: fresh.dates.filter((date) => ids.has(date.gooutEventId)) };
}

async function main() {
  const cached = await readCache();
  const program = JSON.parse(readFileSync(join(ROOT, 'data', 'program.json'), 'utf8'));
  const ourTitles = [...new Set(program.dates.map((entry) => entry.title))];

  let fresh;
  try {
    // Both scopes must answer. Falling back to the performer alone on a venue
    // failure would silently drop every unattributed date, which is the exact
    // bug this second query exists to fix - and it would look like GoOut
    // simply not having those dates.
    const results = await Promise.all([
      fetchScope({ performer: String(PERFORMER_ID) }),
      fetchScope({ venue: String(VENUE_ID) }),
    ]);

    fresh = ours(merge(results), ourTitles);
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
    venueId: VENUE_ID,
    venueUrl: 'https://goout.net/en/studio-citadela/vzalg/',
    ...fresh,
  };

  await mkdir(dirname(CACHE), { recursive: true });
  await writeFile(CACHE, `${JSON.stringify(output, null, 2)}\n`);

  const upcoming = fresh.dates.filter((date) => date.start > new Date().toISOString());
  console.log(
    `Cached ${fresh.productions.length} productions, ${fresh.dates.length} dates ` +
      `(${upcoming.length} upcoming) to data/goout.json`
  );

  // Anything the venue query found that GoOut does not attribute to the
  // company. Printed rather than filtered, because the venue hosts other
  // companies and the operator is the one who can tell which is which.
  for (const production of fresh.productions) {
    const count = fresh.dates.filter((date) => date.gooutEventId === production.gooutEventId).length;
    const how = production.attributed ? 'performer' : 'venue only, NOT attributed on GoOut';
    console.log(`  ${production.title} — ${count} date(s) (${how})`);
  }
}

main();
