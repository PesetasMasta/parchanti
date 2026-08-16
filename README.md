# Kolekce Parchant — web

Prototype site for the theatre company Kolekce Parchant (Studio Citadela, Prague).
Not live anywhere yet. This repo holds the visual direction, the GoOut integration,
and the photo pipeline.

## Two prototypes

- `prototype/canvas.html` — **the live direction.** A pannable 2x2 comic map you
  move across instead of scrolling, zooming into each production and actor.
  Framed as half an adventure game.
- `prototype/index.html` — the earlier scrolling version, kept for comparison.

## Run it

```bash
node scripts/fetch-goout.mjs        # refresh data/goout.json from GoOut
node scripts/embed-data.mjs         # bake those dates into canvas.html
node scripts/redraw-photos.mjs ~/Downloads/parchant   # redraw photos as inked panels (~$0.04 each)
node scripts/inline.mjs canvas      # build/parchant-canvas.html, self-contained
node scripts/inline.mjs             # build/parchant.html (scrolling version)
open -a "Brave Browser" prototype/canvas.html
```

`make-panels.sh` takes an optional source directory as `$1` if the raw photos move.
`embed-data.mjs` writes between `/* GOOUT:START */` markers; `inline.mjs` writes
between `/* ASSETS:START */` markers and turns every panel into a data URI, so the
built file works from `file://` and from a host that blocks external requests.

## Navigation model

Each canvas declares its own grid, so content is never padded to fit a shape:
the root and each production are 2x2, an actor is 2x1.

| Canvas | Cells |
|---|---|
| root | Úvod, Inscenace / O nás, Soubor |
| production | O inscenaci, Obsazení / Galerie, Termíny |
| actor | Profil, Hraje v |

Movement: swipe, mouse drag, trackpad, arrow keys, or the edge arrows. Zoom in by
clicking a tile; out via Escape, the Zpět button, the breadcrumb, or browser back.

Every cell has its own hash route (`#/inscenace/rychle-sipy/terminy`), which is
what makes browser back and forward work and makes any cell linkable. A deep link
skips the title card, so a shared link lands on the content, not a splash screen.

Three devices exist specifically to stop people getting lost in a zoomable
canvas, which is its main failure mode: the mini-map, the breadcrumb, and
redundant exits.

### Adventure framing

- A title card on first visit per session (`sessionStorage`), skipped on deep links.
- A HUD along the bottom: back, breadcrumb, step counter, restart.
- A game-over card on genuine dead ends only. It never blocks anyone: the exits
  from it are GoOut and restart. Copy adapts — a run that finished says
  *Dohráno* with the tally, one that never ran says *Žádné termíny*.

Deliberately not a real fail state. A screen that ejects someone looking for
tickets would be hostile.

## Design direction

Comic page, drawn in the company's own language rather than an imported one.
The palette is lifted from their hand-drawn *Rychlé šípy* poster:

| Token | Hex | Where it comes from |
|---|---|---|
| paper | `#F2E3B8` | the poster's waxy ochre ground |
| ink | `#241A12` | crayon brown-black outline |
| red | `#C4241E` | the hand-lettered title |
| green | `#2E6B3A` | the KLUBOVNA cardboard sign |
| ochre | `#E8A317` | the poster's saturated yellow |
| card | `#C8703A` | cardboard brown |

The comic treatment is justified by the material, not just taste: *Rychlé šípy* is
itself one of the most recognisable Czech comics (Foglar and Fischer), and the
company stages it. The five arrows that drive across their poster — *rychlé šípy*
means rapid arrows — are reused as the site's wayfinding device.

Deliberately single-theme. A comic page is paper, so there is no dark mode.

No webfonts: the display face is a system stack (`Arial Black` first) given
hand-drawn character through per-letter jitter applied in script. This avoids a
font dependency entirely. Trade-off: on a machine without Arial Black the
masthead falls back to Helvetica/Impact and loses some weight.

Photos are ink-posterized to two colours. This is not only styling — the source
images are phone shots with audience heads across the bottom third, and reducing
them to two inks makes amateur capture read as deliberate print.

## GoOut integration

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
  unknown, so the Audience panel deliberately shows a "photo pending" state
  rather than misattributing someone else's production.
- **Cast spelling.** The eleven names in `prototype/index.html` were read off the
  poster photo. Check them against the company's own list before publishing.

## Placeholder content

Everything below needs replacing with her words. It is written to be plausible
and to show how much room the layout gives, not to be correct.

- The pitch bubble on page one.
- All three production blurbs.
- The "O nás" prose panel (marked in italics in the page).

Facts on the page that **are** true: three productions, 23 performances, one
venue, two sold-out dates, premiere 30. 1. 2026, and the credits on the poster.

## Next

1. Production detail pages and actor pages, with the cross-linking (the part she
   asked for): production → cast → other productions.
2. Move from a single HTML file to Astro once the direction is signed off, keeping
   content as files so a git-backed CMS can be layered on later.
3. Photo redraw pass (AI or illustrator) once the new shoot exists.
