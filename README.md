# Kolekce Parchant — web

Site for the theatre company Kolekce Parchant (Studio Citadela, Prague).
Not public yet: it is previewed on GitHub Pages behind `noindex` and a
`robots.txt` disallow, and the domain kolekceparchant.cz is registered but not
pointed anywhere. This repo holds the visual direction, the GoOut integration,
and the photo pipeline.

## How this is built

Astro static site. Content lives in schema-validated collections
(`src/content/`): three productions and fifteen people, with every person
reference checked against the people list at build time. A production that has
not opened yet is a real state the schema models — `blurb`, `score` and
`idivadlo` are optional, because before a premiere there is no rating, nothing
quoted and no i-divadlo page.

    npm install            # once
    npm run dev            # live dev server
    node scripts/check.mjs # build + full check suite (needs Brave installed)
    node scripts/serve.mjs # preview dist/ at http://127.0.0.1:4173/
    bash scripts/publish-docs.sh  # checks, then assembles docs/

Links are root-relative, so the built site is previewed over HTTP, not
file://. The previous single-page prototype is kept as-is in `prototype/`.

`check.mjs` is the test suite. There is no framework: it drives a real headless
Brave over the DevTools protocol, so assertions run against computed styles and
real layout rather than a parsed string. `publish-docs.sh` refuses to publish a
site that does not pass it.

## Design direction

Poster press, spread across real pages: bezruci.cz-style curated homepage plus
one URL per section and one per production, not a single scrolling page. Each
page is a colour band. Circus appears as structure only — 3px ink borders, the
condensing masthead, a full-screen ink menu overlay — never as drawn tents
or masks.

The KP mark is K and P set in Cutive Mono, the face every heading uses, the
letters converted to outlines so the mark does not wait on a webfont. It was a
drawing until 2026-09-12: the client drew it herself, then looked at her own
painted version traced into curves and asked for the hand taken out of it. Both
numbers in it are hers — the P sits 46% of one advance inside the K, and the
mark stands 35px tall in the bar, which is a curve scaled from that number
rather than a pin, so it still shrinks on a narrow screen. Her original drawn
badge is kept in `KPMark.astro` behind `letters={false}` and renders nowhere;
whether it survives anywhere is her decision, not a cleanup.

Palette, as of 2026-09-07: black and white. The green boards the site was built
from are gone, and so is every colour token they fed. The reason is what is
arriving rather than taste — each actor is being given a colour of their own,
and the production photographs are shot in colour — so a page with no palette
leaves the colour to the people and the work.

| Token | Hex | Where it goes |
|---|---|---|
| white | `#FFFFFF` | the paper: ground, cards, the bar, and the ink the dark bands read in |
| ground-deep | `#E6E6E4` | the same paper a shade down: bands and blanks |
| ink | `#1E1B14` | body text, rules, the dark bands, the mark |
| mark | `#AA0A27` | Barbados Cherry, the client's red — the ticket bubble and nothing else |

One red left, and it no longer paints the mark: `--mark` survives only on the
Vstupenky bubble, white on red at 7.5:1. Text never names a colour — it takes
`--accent`, which resolves to ink, so a new link inherits the readable answer.
`check.mjs` enforces WCAG contrast transitively on every page at 320px and
390px, and asserts that the red stays where it is.

Deliberately single-theme. A printed poster is paper, so there is no dark mode:
`color-scheme: only light`.

Type is self-hosted Cutive Mono (display) and Archivo (body) — two woff2
subsets each, latin and latin-ext. Ultra and Archivo Black are both retired.
latin-ext is the requirement that eliminates most display faces: `ě š č ř ž ů ť
ď ň` live in U+0100–017F and are usually the first glyphs a display font drops.
`check.mjs` measures whether they actually render rather than trusting the
subset declaration.

Photos are redrawn by an image model rather than filtered. The previous
pipeline posterized phone shots to two inks to make amateur capture read as
deliberate print; redrawing reinterprets instead, which is what actually fixes
the source material — phone photos with audience heads across the bottom third.

## GoOut integration

**GoOut is not the source of the programme, but it does supply the tickets.**
The client reversed herself on 2026-09-02 — the existing GoOut page stays and
sales go through it — and the arrangement was then settled by measuring rather
than by argument: GoOut carries three of the four productions and four of the
fourteen autumn dates, and still lists a production she asked to have taken off
the site. So it enriches instead of replacing. The page renders from
`data/program.json`, which is ours and hand-kept; `withTickets()` in
`src/lib/program.js` matches GoOut rows onto those dates by date and loose
title and attaches a ticket URL and on-sale state. A `url` written by hand
always wins. A date GoOut does not have renders no link at all, and picks one
up on the next build once somebody enters it in their account.

Their `ticketUrl` is checked before it becomes an `href` — https on goout.net,
and a row that fails is skipped whole. It is the one field on this site that
arrives from somebody else and becomes markup.

The rest of this section is kept because the API notes are hard-won.

`Kolekce Parchant` is performer **2590315** on GoOut
(<https://goout.net/en/kolekce-parchant/pzpmtpg/>).

Endpoint: `https://goout.net/services/feeder/v1/events.json`

- `source=<yourdomain>` is **mandatory** — the API returns 401 without it.
- The feed returns **only future events** unless `after=` is passed explicitly.
  It does not hide past dates once you ask for them; `upcoming()` does that at
  build time, and always did.
- `limit` is **clamped to 100** whatever you ask for, results come back
  **oldest first**, and the rest hides behind `hasNext`. Asking for 200 and
  reading page one returns the oldest hundred and nothing upcoming, which for a
  while looked exactly like a venue with no future dates. `fetchScope()`
  follows `hasNext`.
- Filters used: `performer`, `venue`, `after`, `before`, `limit`. Also supports
  `user`, `keywords`, `scheduleForEvent`.
- The script queries the **venue** (Studio Citadela, 4025) alongside the
  performer, because their Rychlé šípy event carries `performerIds: []` and so
  appears under no performer at all — including on their own GoOut page. That
  is a fault in their account, not ours. Venue rows are filtered against
  `data/program.json`, since a venue is not a company: unfiltered, the archive
  brought in 51 productions and 102 dates of other companies' work.

This endpoint is **undocumented**. `docs.goout.net` redirects to `terms.goout.net`
(legal terms only); the only spec is reverse-engineered third-party work
(`strohel/goout-calendar`, looks stale). Response fields already carry
`@DEPRECATED` markers, so it is an internal API with no contract to us.
`fetch-goout.mjs` therefore never overwrites a good cache with a bad fetch — if
GoOut changes, the calendar goes stale rather than empty.

### What GoOut gives us, and what it does not

Gives us: production titles, image URLs, dates, venue, per-date ticket URL,
`ticketingState` (`SOLD_OUT` / `ENDED` / `CANCELLED`).

Does **not** give us: any descriptions. `text` is empty on both events. All
copy is the company's own. And it does not know about every production —
see below.

### State as of 2026-09-09

Four of the fourteen autumn dates carry a real ticket link: Hra lásky 17. 9. and
1. 10., Rychlé šípy 24. 9. and 3. 10. The other ten wait on somebody entering
them in the GoOut account — work in their account, not in this repo.

GoOut can never be the source of the production list: it has three of the four
productions, and the one it attributes to nobody would vanish from a performer
query. Productions are own content; `gooutEventId` is an optional link per
production.

One incidental confirmation worth keeping: GoOut independently lists Rychlé
šípy on 3. 10. at **16:00**, which matches the unusually early start in the
client's revised plan — she wrote that time with four exclamation marks, and it
is not a typo.

## Open questions

- **Image URLs.** GoOut image `src` values contain a `%%%` size placeholder
  (`https://goout.net/i/134/1345645-%%%.jpg`). None of the obvious tokens resolve
  (`full`, `1024x1024`, `cut`, `min`, `orig`, numeric — all 404). Ask GoOut
  support what replaces it. Until then, production photos come from the company.
- **Is an integration blessed?** Worth asking GoOut whether there's an official
  widget/iframe/API/iCal for organizers, and whether automated pulling is fine.
  If yes, the stability risk above disappears.
- **Photo attribution.** Only the Rychlé šípy photos are identifiable (KLUBOVNA
  sign, shorts, the comic book). Which production the other shots belong to is
  unknown, so the gallery captions them with a safe, production-less caption
  ("Soubor") rather than misattributing someone else's production.
- **Cast list.** Now compiled from the company's i-divadlo profile rather than
  read off a photograph of a poster, which corrected two spellings (Maxmilián
  Kocek, Matouš Vyšata) and removed one name that appears nowhere on the
  profile (Mikuláš Polák). Still needs confirming against the company's own
  list, along with Aliska's full billing name. `robots.txt` disallows
  everything until it is confirmed.

## Still her words to write

One thing on the page is still holding space, marked `data-placeholder` in the
markup so it is greppable: the claim under the logo, empty rather than
invented. The *O nás* prose arrived 2026-08-31 and shipped the same day.

Everything else is her own text or verbatim from the company's i-divadlo
profile — with one reversal. Until 2026-09-02 every slip she wrote stayed on
the page and `check.mjs` asserted it was still there, so a correction failed
the build. That flipped: spelling, agreement and punctuation get proofread, and
each assertion was **inverted** rather than deleted, so a regression back to a
slip is what fails now. Her obecná čeština and her rhythm are left alone —
"s lidma", "v rapovým radiu", the sentence that breaks off at "ale hlavně!" —
because the voice is most of what the site is selling.

Two words are still hers to answer, because fixing them changes a word and not
a form: "To se pomohlo" (almost certainly "povedlo") and "Jiří Dlouhý, další
herci" (which reads like "a další herci"). Both are pinned in `check.mjs` so
they get corrected deliberately rather than by accident.

Thirteen of the fifteen people have no photograph. They render a generated
halftone figure behind milky glass, coloured from their own id so it is stable
between builds — never a stock headshot, because a stranger's face under a
named actor is the one thing a placeholder must not look like.

## Next

1. Point kolekceparchant.cz at a host and lift the `noindex` — the domain is
   registered at WEDOS, the site is previewed on GitHub Pages.
2. One date is unanswered and it blocks going public: Toníkova cesta on
   **22. 10.** is on the site and absent from her September plan. A cancelled
   date and a line missed while retyping look identical on paper, so it was
   kept rather than deleted on a guess. Advertising a performance that is not
   happening is the one error that sends people to a locked door.
3. Content the client still owes: the claim under the logo, a body face to
   replace Archivo, posters for two of the four productions, and a blurb,
   running time and poster for Červánky.
4. The photographs, due end of September 2026, and the per-actor colours that
   go with them.

The enhancement backlog lives outside this repo, in
`~/dev/project-manager/projects/parchanti.yaml`.
