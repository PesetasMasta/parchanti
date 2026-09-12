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
// publish-docs.sh runs check.mjs, which fails once the listed next date is
// behind the build.
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

// --- tickets from GoOut ------------------------------------------------------
//
// Her decision 2026-09-02 reversed the 2026-08-11 one: the existing GoOut page
// stays and becomes where tickets are sold. It does NOT become where the
// program comes from, and that is a measurement rather than a preference - on
// 2026-09-09 the account carried two productions and two upcoming dates
// against the fourteen in data/program.json, and it still lists Audience
// (Pivařská odyssea), which she asked to have taken off the site. So the dates
// stay hand-kept and GoOut supplies what only GoOut can: a link per date, and
// whether that date is still on sale.
//
// Nothing here fails when GoOut is missing a date, which is the normal case
// today: an entry with no match keeps the state it was written with and
// renders no link, exactly as before. As the rest of the autumn is entered
// into the account, those dates pick up links on the next build with no code
// change.

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
