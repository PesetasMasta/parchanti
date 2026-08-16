# Kolekce Parchant — web

Prototype site for the theatre company Kolekce Parchant (Studio Citadela, Prague).
Not live anywhere yet. This repo holds the visual direction, the GoOut integration,
and the photo pipeline.

## The page

`prototype/index.html` — a single scrolling page, no build step, no
dependencies. Seven colour bands you scroll through, in the order the client
asked for: program, repertoár, soubor, o nás, o prostoru, fotky.

`prototype/canvas.html` — the superseded direction: a pannable 2x2 comic map
you moved across instead of scrolling. Kept as a record, still published at
`/canvas.html`. Two things retired it: the client asked for a burger menu over
six named sections, which is a scroll-page structure and not a spatial one, and
the inspiration boards she then shared pointed at mid-century circus poster
rather than Foglar comic. The reasoning is in
`specs/2026-08-16-poster-press-scroll-design.md`.

## Run it

```bash
node scripts/fetch-fonts.mjs                  # download the four woff2 subsets
node scripts/redraw-photos.mjs ~/Downloads/parchant   # redraw photos as inked panels (~$0.04 each)
node scripts/check.mjs                        # assertions: contrast, overflow, content, metadata
node scripts/shot.mjs "file://$PWD/prototype/index.html" /tmp/kp.png 390 844
./scripts/publish-docs.sh                     # assemble docs/ for GitHub Pages
open -a "Brave Browser" prototype/index.html
```

`check.mjs` is the test suite. There is no framework: it drives a real headless
Brave over the DevTools protocol, so assertions run against computed styles and
real layout rather than a parsed string. `publish-docs.sh` refuses to publish a
page that does not pass it.

## Design direction

Poster press. The page is a stack of printed posters, so each section is a
colour band and scrolling reads as flipping through a pile. Circus appears as
structure only — perforated ticket edges, notched ribbon section heads, arrow
signs, diamond dividers — never as drawn tents or masks.

Palette, taken from the two colour boards the client shared, which propose the
same idea independently:

| Token | Hex | Where it goes |
|---|---|---|
| paper | `#FFFECD` | cream bands; text on deep red |
| ground | `#B0BC68` | olive bands |
| ground light | `#CDD78A` | lime bands |
| punch red | `#EB313F` | KP monogram, display type |
| cherry | `#AA0A27` | red body text and links |
| ink | `#1E1B14` | body text |

Two reds, deliberately. Punch red on cream is about 4.2:1 — enough for large
display type, short of the 4.5:1 body text needs — so it is display-only and
cherry carries anything small. Cream never sits on olive, which is about 2:1.
`check.mjs` enforces both rules and fails the build rather than trusting anyone
to remember them.

Outlined display type is exempt from the ratio check, because the ratio model
does not describe it: legibility comes from a hard ink edge on all sides. The
exemption is paid for by asserting the outline is actually present.

Deliberately single-theme. A printed poster is paper, so there is no dark mode.

Type is self-hosted Archivo Black and Archivo — two woff2 subsets each, latin
and latin-ext. latin-ext is the requirement that eliminates most display faces:
`ě š č ř ž ů ť ď ň` live in U+0100–017F and are usually the first glyphs a
display font drops. `check.mjs` measures whether they actually render rather
than trusting the subset declaration.

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

1. Production detail pages and actor pages, with the cross-linking (the part she
   asked for): production → cast → other productions.
2. Move from a single HTML file to Astro once the direction is signed off, keeping
   content as files so a git-backed CMS can be layered on later.
3. Photo redraw pass (AI or illustrator) once the new shoot exists.
