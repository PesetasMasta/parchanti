# Multi-page site — design

Date: 2026-08-17
Status: approved direction, not yet implemented
Supersedes the shell of: `specs/2026-08-16-poster-press-scroll-design.md`
(that spec's content decisions, palette and content-integrity rules still stand)

## Why this replaces the single scroll page

Client feedback of 2026-08-17, on seeing the scroll page:

1. The display face should be the high-contrast serif from her inspiration board,
   not a grotesk.
2. The logo should be built like the *COURAGE* reference — layered deco lettering.
3. The layout should follow bezruci.cz: **not everything on one page**. Each
   section is its own page.

Point 3 is the architectural one. bezruci.cz is a curated homepage plus real
pages per section, with each production on its own URL. That is a site, not a
scroll page with anchors.

Building that without a build step would mean hand-duplicating the header,
footer and stylesheet across every page, and again for every production. So this
also promotes the Astro migration that has sat on the backlog, and picks up the
backlog's top item — production → cast → other productions cross-linking — as a
consequence rather than as extra work.

## Type

| Role | Face | Notes |
|---|---|---|
| Display | **DM Serif Display** | Chosen from four candidates rendered in the palette with real Czech |
| Body | **Archivo** | Already self-hosted with verified Czech coverage; unchanged |

Both self-hosted, `latin` and `latin-ext` subsets, no third-party requests.

**Prata is rejected.** It was the closest match to the board but ships no
`latin-ext`, so every `š č ř ž ů ť ď ň` would fall back to another font
mid-word. Czech stacks far more diacritics than English and this constraint
eliminates most display faces — it is the reason to verify coverage before
choosing, not after.

Archivo Black is retired as the display face.

## The KP mark

Drawn once as SVG, not set in a typeface. The *COURAGE* reference is lettering.

Construction — a **stroked skeleton drawn twice**:

1. Extrusion: the skeleton offset down-right, stroked solid `--ink`
2. Body: the skeleton stroked `--cherry` at the same weight
3. Inline: the same skeleton stroked `--cream` at roughly a quarter weight,
   producing the thin light line that runs inside each stroke

A swash rises off the **P** and curls right, echoing the tall curl on the
reference's U.

**No sparkles.** The four-pointed stars are dropped from the mark. They may be
reused independently — as section dividers or beside pull quotes — but they are
not part of the logo.

A *hollow* extrusion was considered and rejected: it is hollow only because its
inner stroke is painted the background colour, which makes the mark
background-dependent and would need a variant per band. The solid extrusion
drops one detail from the reference and works unchanged on cream, lime, olive
and ink.

**Lockup:** mark on the left, `Kolekce Parchant` in DM Serif Display to its
right, as on bezruci.cz. The mark alone serves the condensed header, the favicon
and the Instagram avatar.

## Palette

Tokens carry over unchanged, except one deletion.

| Token | Hex | Use |
|---|---|---|
| `--cream` | `#FFFECD` | page ground, text on cherry |
| `--lime` | `#CDD78A` | primary accent band |
| `--olive` | `#B0BC68` | secondary band, photo placeholders |
| `--cherry` | `#AA0A27` | the red — mark, display type, links, ribbons |
| `--ink` | `#1E1B14` | body text, extrusion, rules |

**`--red` `#EB313F` is dropped.** Every approved mockup used cherry alone, and
the client's board pairs Lime Sherbet `#cdd78a` with Barbados Cherry `#aa0a27`
specifically. With one red, the two-reds rule from the previous spec — punch red
for display only, cherry for body — disappears, and the check that enforced it
becomes unnecessary. Cherry on cream is about 7.3:1 and passes for body text at
any size.

The rule that survives: **cream never sits on lime or olive** (about 2:1). Those
grounds take `--ink`.

Three places currently use `--red` and become `--cherry`: the masthead monogram,
the footer mark, and the left rule on press quotes. Nothing else references it.

## Header

Mobile is the primary target.

- **At the top of the page:** full lockup — mark plus name — with the Menu button.
- **After scrolling:** condenses to the mark plus Menu. The name drops away and
  the mark steps down to the smaller size. The mark remains a link home.

  The condensed height is not fixed in this spec. It is derived at
  implementation by measuring the rendered bar, the same way `scroll-padding-top`
  was — a hard-coded number silently stops matching the moment the type size or
  padding changes. Whatever the value, the scroll offset that clears the sticky
  bar must be measured against the **condensed** height, since that is the state
  in effect once the page has scrolled.
- The transition is suppressed under `prefers-reduced-motion`, so it snaps
  rather than animates.

The burger overlay keeps everything the current implementation earned: real
`<button>` with `aria-expanded`, `role="dialog"`, `aria-modal`, Escape to close
with focus returned, and a focus trap wrapping in both directions.

## Homepage

Split layout. Identity beside the work.

1. **First screen, two halves:** left carries the name in DM Serif, the claim
   slot, the pitch and a Program button; right carries a photograph. On a phone
   the halves stack, name first.
2. **Nejbližší představení** — the next-performance strip.
3. **The two productions** as cards, linking to their pages.
4. Footer.

There are still **no upcoming dates**, so the strip's empty state is the normal
launch state. Placing it below the first screen rather than above it was
deliberate: it stays honest without being the first thing a visitor meets.

## Routes

| Route | Contents |
|---|---|
| `/` | the homepage above |
| `/program` | performance dates, empty state until she publishes |
| `/repertoar` | both productions |
| `/repertoar/[slug]` | one production: annotation, credits, cast, press, gallery |
| `/soubor` | the ensemble |
| `/soubor/[slug]` | one person: roles, and the productions they appear in |
| `/o-nas` | the company |
| `/o-prostoru` | Studio Citadela, address, trams |
| `/fotky` | gallery |

Menu order follows the client's original list: Program, Repertoár, Soubor,
O nás, O prostoru, Fotky.

## Content model

Astro **content collections with schema validation**.

- `productions` — slug, title, subtitle, author, credits, annotation, her blurb,
  premiere, duration, age rating, i-divadlo URL, score, quotes, cast (array of
  person slugs), photos.
- `people` — slug, name, roles.

Cross-linking falls out of it: a production lists cast slugs, and a person's page
queries the productions containing their slug. Neither direction is maintained by
hand.

The schema is not ceremony here. This project's dominant risk has been content
integrity — a name the client asked to be removed, a corrected spelling reverting,
a production referencing someone who does not exist. A schema catches that class
at build time, which is earlier than any check can.

## What carries over unchanged

Every content decision from the previous spec stands: the two approved
productions with *Audience / Pivařská odysea* omitted, the October 2026 premiere
excluded, the cast corrections (Aliska, Maxmilián Kocek, Matouš Vyšata, Mikuláš
Polák removed), the press quotes with their asymmetric treatment, her verbatim
blurbs including `v nové size`, the two marked placeholders, photo attribution
limited to identifiable productions, and the footer links without Facebook.

Also carried over: the photo redraw pipeline, the publish gate that refuses to
publish a failing build, and the `robots.txt` disallow until the cast list is
confirmed.

## Verification

The check suite becomes multi-page. It builds the site, then runs every check
against **every generated page** at 320px and 390px.

The content-integrity checks must run on every page, not just one — there are now
far more places for a removed name to reappear. Specifically these run per page:

- `v nové size` present wherever her blurb appears
- no `Pivařská`, `Aneta Kalertová`, `Mikuláš Polák`, `Višata`
- no `červánky` / `Hančilová`
- placeholders still empty and marked
- no horizontal scroll; contrast against the band ground

Because Astro generates pages, a new check is needed that the route list matches
the expected set — otherwise a page could silently disappear and every remaining
page would still pass.

## Deployment

Deferred by decision. The build continues to output into `docs/` with the
existing `robots.txt` disallow, so publishing behaves exactly as it does now.
Choosing a host and pointing kolekceparchant.cz at it is a separate decision once
the client has signed off on the design.

## Still blocked on the client

Unchanged from the previous spec, and none of it blocks building:

1. The claim under the logo.
2. The *O nás* prose.
3. Cast list confirmation, including Aliska's full billing name.
4. `v nové size` — did she mean `verzi`?
5. Should the October 2026 premiere be announced?
6. Facebook in the footer alongside Instagram?
7. Autumn dates on GoOut, so Program stops showing its empty state.
