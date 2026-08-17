# Kolekce Parchant — web

Prototype site for the theatre company Kolekce Parchant (Studio Citadela, Prague).
Not live anywhere yet. This repo holds the visual direction, the GoOut integration,
and the photo pipeline.

## How this is built

Astro static site. Content lives in schema-validated collections
(`src/content/`): two productions and eleven people, with every person
reference checked against the people list at build time.

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
condensing masthead, a full-screen cherry menu overlay — never as drawn tents
or masks.

The KP mark is drawn once as SVG, not set in a typeface: a stroked skeleton
drawn three times — an ink extrusion offset down-right, a cherry body on top,
and a thin cream inline running through each stroke. No sparkles.

Palette, taken from the two colour boards the client shared, which propose the
same idea independently:

| Token | Hex | Where it goes |
|---|---|---|
| cream | `#FFFECD` | page ground; text on cherry |
| lime | `#CDD78A` | primary accent bands |
| olive | `#B0BC68` | secondary bands, photo placeholders |
| cherry | `#AA0A27` | the red — mark, display type, links, ribbons |
| ink | `#1E1B14` | body text, extrusion, rules |

One red, deliberately. Cherry on cream is about 7.3:1, which clears WCAG body
text at any size, so a single red does the whole job (an earlier punch red
`#EB313F` was dropped for exactly this reason and must not come back). The
rule that survives: cream never sits on lime or olive, both close to 2:1 — those
grounds take ink instead. `check.mjs` enforces WCAG contrast transitively on
every page at 320px and 390px and fails the build rather than trusting anyone
to remember the rule.

Deliberately single-theme. A printed poster is paper, so there is no dark mode.

Type is self-hosted DM Serif Display (display) and Archivo (body) — two woff2
subsets each, latin and latin-ext. Archivo Black is retired. latin-ext is the
requirement that eliminates most display faces: `ě š č ř ž ů ť ď ň` live in
U+0100–017F and are usually the first glyphs a display font drops. `check.mjs`
measures whether they actually render rather than trusting the subset
declaration.

Photos are redrawn by an image model rather than filtered. The previous
pipeline posterized phone shots to two inks to make amateur capture read as
deliberate print; redrawing reinterprets instead, which is what actually fixes
the source material — phone photos with audience heads across the bottom third.

## GoOut integration

**GoOut is no longer the source of truth.** The client's feedback of 2026-08-11
says the account is not under their management and they will arrange their own.
The page renders from `data/program.json`, which is ours. `fetch-goout.mjs`
stays as an optional refresh and nothing on the page depends on it running. The
rest of this section is kept because the API notes are hard-won and still true.

`Kolekce Parchant` is performer **2590315** on GoOut
(<https://goout.net/en/kolekce-parchant/pzpmtpg/>).

Endpoint: `https://goout.net/services/feeder/v1/events.json`

- `source=<yourdomain>` is **mandatory** — the API returns 401 without it.
- The feed returns **only future events** unless `after=` is passed explicitly.
- Filters used: `performer`, `after`, `before`, `limit`. Also supports `venue`,
  `user`, `keywords`, `scheduleForEvent`.

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

### State as of 2026-08-08

| Production | GoOut ID | Dates | Note |
|---|---|---|---|
| Hra lásky a náhody | 3242569 | 17 | 2 sold out |
| Audience (Pivařská Odyssea) | 3304956 | 6 | |
| Rychlé šípy a záhada klubovny | — | — | **not on GoOut at all** |

23 dates total, all at Studio Citadela, Klimentská 16, Praha 1.
Range 2025-05-02 → 2026-05-23. **Zero upcoming.**

Two consequences that drove the design:

1. The calendar renders empty today. The next-date panel has a deliberate empty
   state instead of a blank box. New dates need publishing on GoOut before launch.
2. Because Rychlé šípy is absent from the feed, GoOut can never be the source of
   the production list. Productions are own content; `gooutEventId` is an
   optional link per production.

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

Two things on the page are still holding space, both marked `data-placeholder`
in the markup so they are greppable:

- the claim under the logo, which is empty rather than invented
- the *O nás* prose

Everything else is her own text or verbatim from the company's i-divadlo
profile. Facts on the page that are true: two productions, one venue, premieres
30. 1. 2026 and 2. 5. 2025, 75 minutes without an interval, 6+.

One word to check before launch: her *Rychlé šípy* blurb reads "v nové size",
which is almost certainly meant to be "v nové verzi". It is left as she wrote
it.

## Next

1. Hosting and DNS decision — the site is not live anywhere yet.
2. Content the client has blocked: the claim under the logo and the *O nás*
   prose, both still `data-placeholder` in the markup.
3. The actors-moving animation.
4. Gallery panel regeneration once more redrawn photos exist.
