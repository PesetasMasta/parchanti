# Dates from GoOut — design

2026-11-20. Approved in conversation by the developer.

## Why

The site's dates came only from `data/program.json`, hand-copied from the
schedule the client sent in September (last edited 2026-09-11). She has kept
GoOut current since and the file has not been: on 2026-11-20 the site was
missing that evening's Červánky, and eight autumn entries disagreed with GoOut.
She enters her dates into GoOut herself, so GoOut is where they are right.

The September decision (recorded in `program.json` and `src/lib/program.js`)
not to source dates from GoOut was a measurement, not a principle: the account
then had 2 upcoming dates against her 14 and listed Audience (Pivařská
odyssea), which she asked to keep off the site. The first no longer holds; the
second still must.

## Goals

- A production **with a page on the site** (a file in
  `src/content/productions/`) takes its dates from GoOut, whenever GoOut lists
  that production at all.
- Everything else keeps coming from `program.json`: productions without a page
  (Toníkova cesta), and productions with a page that GoOut does not list yet.
- Notes she wrote (`premiéra`, `první repríza`) survive when GoOut has a date
  for the same production on the same day.
- The cached feed in the repo stays at most a day old.

## Non-goals

- No date can appear for a production without a page by way of GoOut. This is
  what keeps Audience off the site.
- No change to how tickets look, to the empty state, or to the calendar.
- No new dependencies.

## Anti-goals

- A hand-written date for a GoOut-listed production that GoOut does not have
  must not appear. That is the drift this removes.
- A cancelled GoOut date must not appear.

## Approaches considered

1. Keep `program.json` authoritative and update it by hand. Rejected: that is
   the arrangement that drifted.
2. **GoOut authoritative for productions with a page, `program.json` for the
   rest. Chosen** (developer, 2026-11-20).

## Decided

- The switch is per production: if GoOut has any row (past or future,
  cancelled or not) whose event title agrees with the production's full title
  (`titlesAgree`, `titleLead` + `titleRest`), all of that production's dates
  come from GoOut and its hand entries are used only for notes.
- An entry built from GoOut: `date` and `time` from the row's local start,
  `title` the production's full title, `slug`, `when` derived by
  `displayWhen`, `note` from a hand entry with the same slug and date, `state`
  `on_sale` / `sold_out` with the Czech ticket URL when GoOut sells it,
  otherwise `announced` with no URL.
- Hand entries keep today's `withTickets` behaviour.
- The deploy workflow commits `data/goout.json` back to `main` when the fetch
  changed it, so the fallback cache is the last good night, not the last time
  someone ran the script by hand.

## Left to the builder

Names of helpers, where the Astro-side loader lives, commit-bot identity.
