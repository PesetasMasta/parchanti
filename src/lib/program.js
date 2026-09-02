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
