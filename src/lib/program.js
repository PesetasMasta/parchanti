// Program dates: one place that turns the ISO fields in data/program.json
// into what the page shows, and picks the next performance.
//
// The client writes her dates as display text ("čt 17. 9. 20:00"), which is
// kept verbatim in `when` because it is hers. Nothing here parses that string:
// every rendered part is derived from `date` + `time`, and scripts/check.mjs
// derives `when` the same way and fails the build if the two disagree. A
// weekday that has drifted off its date is then a failed build, not a wrong
// poster.

const WEEKDAYS = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];

// UTC throughout: these are calendar days, not instants, and building the site
// in a timezone behind Prague must not move a date to the day before.
export function czechDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  const weekday = WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
  return `${weekday} ${day}. ${month}.`;
}

export function displayWhen(entry) {
  return `${czechDate(entry.date)} ${entry.time}`;
}

// ISO dates compare correctly as strings, so no Date objects are involved.
export function todayISO(now = new Date()) {
  return now.toISOString().slice(0, 10);
}

// Everything still to be played, in order. The site is static, so "today" is
// the build date: a rebuild is what retires a past performance. That is why
// .github/workflows/pages.yml rebuilds nightly, and why check.mjs fails once
// the listed next date is behind the build.
export function upcoming(dates, today = todayISO()) {
  return dates.filter((entry) => entry.date >= today);
}

// Minutes, always: "je důležitý to psát v minutách" (client, 2026-09-02).
// This reverses her own 2026-08-31 correction - "u šípu dej čas hodinu" - which
// is the only reason this ever had an hours branch to delete. Kept as a
// function rather than inlined at the two call sites so the next revision of
// her mind lands in one place.
export function czechDuration(minutes) {
  return `${minutes} min`;
}

// Czech month names, and the Monday-first weekday order a Czech calendar is
// read in. WEEKDAYS above is Sunday-first because that is what getUTCDay
// returns; this is the reading order, which is a different thing.
export const MONTH_NAMES = [
  'leden', 'únor', 'březen', 'duben', 'květen', 'červen',
  'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec',
];

export const WEEKDAYS_SHORT = ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'];

export function czechMonth(iso) {
  const [year, month] = iso.split('-').map(Number);
  return `${MONTH_NAMES[month - 1]} ${year}`;
}

// Monday-first index, 0 = Monday.
export function weekdayIndex(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return (new Date(Date.UTC(year, month - 1, day)).getUTCDay() + 6) % 7;
}

// The months these dates fall in, each as rows of seven cells: leading blanks
// to reach the first weekday, then every day of the month with whatever is
// played on it. Built here rather than in the page so the calendar is
// rendered at build time - it works before any script runs, and the browser is
// never asked to compute a calendar the build already knows.
export function monthGrids(dates) {
  const keys = [...new Set(dates.map((entry) => entry.date.slice(0, 7)))];

  return keys.map((key) => {
    const [year, month] = key.split('-').map(Number);
    // Day 0 of the next month is the last day of this one.
    const length = new Date(Date.UTC(year, month, 0)).getUTCDate();

    const cells = Array.from({ length: weekdayIndex(`${key}-01`) }, () => null);
    for (let day = 1; day <= length; day += 1) {
      const iso = `${key}-${String(day).padStart(2, '0')}`;
      cells.push({ day, iso, entries: dates.filter((entry) => entry.date === iso) });
    }

    const weeks = [];
    for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
    return { key, label: czechMonth(`${key}-01`), weeks };
  });
}

// --- dates and tickets from GoOut --------------------------------------------
//
// Her decision 2026-09-02 made the existing GoOut page where tickets are sold.
// On 2026-09-09 it was deliberately NOT made where the program comes from: the
// account carried two upcoming dates against the fourteen in
// data/program.json, and it lists Audience (Pivařská odyssea), which she asked
// to have taken off the site.
//
// The first reason stopped holding. By 2026-11-20 she had kept GoOut current
// and the hand file had not been touched since 2026-09-11: that evening's
// Červánky was on sale and missing from the site, and eight autumn entries
// disagreed with GoOut. So schedule() below takes a production's dates from
// GoOut whenever GoOut lists it at all - but only for productions with a page
// on the site, which is what keeps the second reason honoured: Audience has
// no page, so nothing of it can arrive this way.
//
// withTickets() still serves the hand entries that remain (Toníkova cesta,
// and any production GoOut does not list yet): a link per date and whether it
// is on sale, and nothing when GoOut has no match.

// GoOut sells under the full title, she writes the short one: "Červánky"
// against "Ale ty červánky jsou stejně nejkrásnější". Comparing loosely is
// what lets her short forms survive, and the date has to agree as well, so a
// loose title on its own can never mint a link.
function loose(title) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function titlesAgree(ours, theirs) {
  const a = loose(ours);
  const b = loose(theirs);
  return a === b || a.includes(b) || b.includes(a);
}

const STATES = { ACTIVE: 'on_sale', SOLD_OUT: 'sold_out' };

// The site is Czech; the feeder answers in English URLs.
function czechUrl(url) {
  return url.replace('://goout.net/en/', '://goout.net/cs/');
}

// Their value goes straight into an href, so it is checked before it gets
// there rather than trusted because it arrived over TLS. Nothing here suspects
// GoOut of anything - the point is that a field from somebody else's API is
// the one input on this site that becomes markup, and "javascript:" in an href
// runs. A link that fails this is dropped rather than repaired: there is no
// safe way to guess what a malformed ticket URL meant.
function isTicketUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && (parsed.hostname === 'goout.net' || parsed.hostname.endsWith('.goout.net'));
  } catch {
    return false;
  }
}

export function withTickets(dates, goout) {
  const titleOf = new Map((goout?.productions ?? []).map((p) => [p.gooutEventId, p.title]));

  return dates.map((entry) => {
    // A ticket link written by hand wins. She has sent two schedules by hand
    // already, the second correcting the first, and an endpoint whose own
    // responses carry @DEPRECATED markers is not something to make the only
    // way a link can reach the page.
    if (entry.url) return entry;

    const match = (goout?.dates ?? []).find((row) => {
      if (row.cancelled) return false;
      if (!STATES[row.ticketingState]) return false;
      if (row.start.slice(0, 10) !== entry.date) return false;
      if (!isTicketUrl(row.ticketUrl)) return false;
      const theirs = titleOf.get(row.gooutEventId);
      return Boolean(theirs) && titlesAgree(entry.title, theirs);
    });

    if (!match) return entry;
    return { ...entry, url: czechUrl(match.ticketUrl), state: STATES[match.ticketingState] };
  });
}

// GoOut marks a cancellation two ways, and rows have been seen with either.
function isCancelled(row) {
  return row.cancelled || row.ticketingState === 'CANCELLED';
}

// Stricter than titlesAgree, because here one match imports every date an
// event has rather than lending a link to a date we already had. The cache
// holds every company's shows at Studio Citadela, so another company's "Hra"
// must not become Hra lásky a náhody. The same title, or one being the other
// plus more words, as long as the shorter has two words at least: GoOut sells
// Rychlé šípy a záhada klubovny as "Rychlé šípy". An empty title matches
// nothing.
function sameShow(ours, theirs) {
  const a = loose(ours).split(' ').filter(Boolean);
  const b = loose(theirs).split(' ').filter(Boolean);
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length === 0) return false;
  if (shorter.length === longer.length) return shorter.join(' ') === longer.join(' ');
  return shorter.length >= 2 && shorter.every((word, index) => word === longer[index]);
}

// Every GoOut row that is this production, cancelled or not.
function rowsOf(production, goout) {
  const ids = new Set((goout?.productions ?? [])
    .filter((event) => sameShow(production.title, event.title))
    .map((event) => event.gooutEventId));
  return (goout?.dates ?? []).filter((row) => ids.has(row.gooutEventId));
}

// One GoOut row as an entry the pages render. The start carries its own
// offset, so the first sixteen characters are already Prague's calendar day
// and clock, summer or winter. Her note for the same day survives; nothing
// else of the hand entry does, because GoOut is the one that is kept current.
function entryFromRow(row, production, handDates) {
  const date = row.start.slice(0, 10);
  const time = row.start.slice(11, 16);
  const hand = handDates.find((entry) => entry.slug === production.slug && entry.date === date);
  const state = STATES[row.ticketingState];
  const sells = Boolean(state) && isTicketUrl(row.ticketUrl);
  return {
    date,
    time,
    when: displayWhen({ date, time }),
    title: production.title,
    slug: production.slug,
    ...(hand?.note ? { note: hand.note } : {}),
    ...(sells ? { url: czechUrl(row.ticketUrl), state } : { state: 'announced' }),
  };
}

// The dates the site shows, past ones included - callers take upcoming().
// `productions` is every production with a page, as { slug, title } with the
// full title. A production GoOut lists at all takes all its dates from GoOut
// and its hand entries are dropped, so a date she moved on GoOut cannot also
// linger here. One GoOut does not list yet (a premiere not yet on sale) keeps
// its hand dates, as does anything without a page - which is also why a
// GoOut event with no page, like Audience, never reaches the site.
export function schedule(handDates, goout, productions) {
  const fromGoout = new Set();
  const entries = [];

  for (const production of productions) {
    const rows = rowsOf(production, goout);
    if (rows.length === 0) continue;
    fromGoout.add(production.slug);
    for (const row of rows) {
      if (!isCancelled(row)) entries.push(entryFromRow(row, production, handDates));
    }
  }

  const handKept = withTickets(handDates.filter((entry) => !fromGoout.has(entry.slug)), goout);

  return [...entries, ...handKept]
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}
