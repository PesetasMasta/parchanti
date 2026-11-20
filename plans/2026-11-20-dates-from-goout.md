# Dates from GoOut Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Productions with a page take their dates from the GoOut feed; everything else keeps coming from `data/program.json`.

**Architecture:** One pure function, `schedule()` in `src/lib/program.js`, merges the hand dates and the GoOut cache into the list every page renders. Pages get it through one Astro-side loader; `scripts/check.mjs` calls the same function with the same inputs, so page and check cannot disagree. The deploy workflow commits the refreshed cache back.

**Tech Stack:** Astro 7, Node 22+ (`node:test`, no new dependencies), GitHub Actions.

**Spec:** `specs/2026-11-20-dates-from-goout-design.md`

## Global Constraints

- No new npm dependencies.
- A production without a page (no file in `src/content/productions/`) never gets a date from GoOut.
- Ticket URLs keep going through `isTicketUrl` and `czechUrl`.
- Comments in English; code comments explain why, in the repo's existing voice, dated.
- `when` on every entry equals `displayWhen(entry)`.

## Review Focus

1. A production with a page that GoOut does not list at all (a new premiere) still shows its hand dates.
2. A future GoOut row that is not on sale yet (`ticketingState` not ACTIVE/SOLD_OUT, not cancelled) shows as `announced` with no link.
3. A GoOut row in summer time (`+02:00`) yields the local time, not UTC.
4. An event GoOut attributes to the company but which has no page (Audience) yields no entry.
5. A hand entry on the same day as a GoOut row for the same production yields one entry, carrying the hand note.

All five are tests in Task 1.

---

### Task 1: `schedule()` merges hand dates and GoOut

**Files:**
- Modify: `src/lib/program.js` (add `schedule`, `gooutEntries`; rewrite the "tickets from GoOut" header comment to record the 2026-11-20 reversal)
- Create: `scripts/program.test.mjs`
- Modify: `package.json` (add `"test": "node --test scripts/"`)

**Interfaces:**
- Consumes: existing `withTickets`, `titlesAgree`, `displayWhen`, `isTicketUrl`, `czechUrl`, `STATES` in the same file.
- Produces: `export function schedule(handDates, goout, productions)` where `productions` is `Array<{ slug: string, title: string }>` (title = full title), returning entries `{ date, time, when, title, slug?, note?, url?, state }` sorted by `date` then `time`, past dates included (callers apply `upcoming`).

- [ ] **Step 1: Write the failing tests** in `scripts/program.test.mjs`, using a hand-built fixture (two productions with pages: `{slug:'sipy', title:'Rychlé šípy a záhada klubovny'}`, `{slug:'nova', title:'Nová hra'}`; GoOut events "Rychlé šípy" and "Audience (Pivařská Odyssea)"):
  - `goout dates replace hand dates for a listed production`: hand Šípy 2026-11-14 absent from output; GoOut Šípy 2026-12-03 present with `slug:'sipy'`, full title, `when:'čt 3. 12. 20:00'`.
  - `cancelled goout dates are dropped`: a row with `cancelled:true` and a row with `ticketingState:'CANCELLED'` both yield no entry.
  - `not on sale yet is announced without a link`: row `ticketingState:'ENDED'` (the only non-selling, non-cancelled state seen in the cache) → `state:'announced'`, no `url`.
  - `sold out keeps its state`: row `ticketingState:'SOLD_OUT'` → `state:'sold_out'`.
  - `summer offset keeps local time`: start `2026-06-05T18:00:00+02:00` → `time:'18:00'`, `date:'2026-06-05'`.
  - `hand note survives on the same day`: hand `{date:'2026-12-03', slug:'sipy', note:'derniéra'}` + GoOut row that day → exactly one entry, `note:'derniéra'`, `url` starting `https://goout.net/cs/`.
  - `production missing from goout keeps hand dates`: hand `nova` entry is output unchanged.
  - `no page, no goout date`: no output entry has title starting `Audience`.
  - `hand entries without a slug pass through withTickets`: Toníkova hand entry present.

- [ ] **Step 2: Run** `npm test` — Expected: FAIL, `schedule` is not exported.

- [ ] **Step 3: Implement `schedule(handDates, goout, productions)`** in `src/lib/program.js`. A production is GoOut-sourced iff any `goout.productions` event title `titlesAgree` with its full title and that event has at least one row in `goout.dates`. For those: map each non-cancelled row to an entry (time = `row.start.slice(11, 16)`), attach `note` from the hand entry with the same `slug` and `date`, drop that production's hand entries. All other hand entries go through `withTickets`. Sort.

- [ ] **Step 4: Run** `npm test` — Expected: all 9 pass.

- [ ] **Step 5: Commit** — `git add src/lib/program.js scripts/program.test.mjs package.json && git commit -m "Merge GoOut dates over hand dates for productions with a page"`

### Task 2: Pages and checks render `schedule()`

**Files:**
- Create: `src/lib/site-dates.js` — `export async function siteDates()`: reads `data/program.json`, `data/goout.json`, `getCollection('productions')`, returns `schedule(...)` with `title` = `[titleLead, titleRest].filter(Boolean).join(' ')`.
- Modify: `src/pages/index.astro:24` (drum), `src/pages/program.astro:17`, `src/pages/repertoar/index.astro:14`, `src/pages/repertoar/[slug].astro:33` — each uses `upcoming(await siteDates())` instead of `program.dates` / `withTickets(...)`. `index.astro:32` (`otherTitles`) stays on `program.dates`: pageless titles are hand-only.
- Modify: `scripts/check.mjs` — define once after `productions`: `const siteDates = schedule(program.dates, goout, productions.map(p => ({ slug: p.slug, title: [p.titleLead, p.titleRest].filter(Boolean).join(' ') })))`; replace every `upcoming(program.dates)` and `upcoming(withTickets(program.dates, goout))` (lines ~60, 658, 669, 904, 962, 1032) with `upcoming(siteDates)`. The `when` vs `date`/`time` assertion in section 0 stays on `program.dates`. Update the comment at ~959 ("Twelve of the fourteen...") to the new arrangement.
- Modify: `data/program.json` — rewrite `note` and `source` to say which dates now come from GoOut and why (2026-11-20); remove the stopgap 2026-11-20 Červánky entry only if the check still passes without it (it should: GoOut has it).

**Interfaces:**
- Consumes: `schedule` from Task 1.
- Produces: `siteDates(): Promise<Entry[]>`.

- [ ] **Step 1: Switch `check.mjs`** to `siteDates` and **delete the stopgap 2026-11-20 Červánky entry** from `program.json`. Run `npm run check` — Expected (run on 2026-11-20, while that date is still upcoming): FAIL on `/program/` and the drum, because the pages still render the hand list, which no longer has tonight, while `siteDates` gets it from GoOut. This proves the check sees the difference.
- [ ] **Step 2: Add `site-dates.js` and switch the four pages.**
- [ ] **Step 3: Run** `npm run check` — Expected: `all checks passed`. Screenshot `/program/` at 390 and confirm 20. 11. Červánky is listed with a ticket link and 1. 12. still reads "druhá repríza".
- [ ] **Step 4: Rewrite the `note` and `source` text in `program.json`**, run `npm test && npm run check` — Expected: both pass.
- [ ] **Step 5: Commit** — `git commit -m "Render dates from GoOut for productions with a page"`

### Task 3: Deploy keeps the cache fresh in the repo

**Files:**
- Modify: `.github/workflows/pages.yml`

- [ ] **Step 1:** Grant `contents: write` in `permissions`. After `node scripts/fetch-goout.mjs`, add a step that commits `data/goout.json` only when `git diff --quiet data/goout.json` fails, as `github-actions[bot]` (`41898283+github-actions[bot]@users.noreply.github.com`), message `Refresh the GoOut cache`, then `git pull --rebase origin main && git push origin HEAD:main`, with `continue-on-error: true` so a lost race never blocks the deploy. Pushes made with `GITHUB_TOKEN` do not trigger workflows, so this cannot loop.
- [ ] **Step 2: Verify locally** that the file still parses: `ruby -ryaml -e 'YAML.load_file(".github/workflows/pages.yml")'` (ships with macOS) — Expected: no output, exit 0.
- [ ] **Step 3: Commit and push all three tasks**, then confirm on GitHub that the run passed and, when the feed changed, a `Refresh the GoOut cache` commit by `github-actions[bot]` landed on `main`.
