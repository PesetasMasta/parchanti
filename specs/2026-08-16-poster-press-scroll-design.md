# Poster-press scroll page — design

Date: 2026-08-16
Status: approved direction, not yet implemented
Supersedes: the pannable comic-canvas direction (`prototype/canvas.html`)

## Why this replaces the canvas

The canvas prototype was a 2x2 pannable comic map. Two things killed it. The
client's feedback of 2026-08-11 asks for a burger menu over six named sections,
which is a scroll-page information architecture, not a spatial one. And the
inspiration boards she shared point at a different visual world altogether:
mid-century circus poster, not Foglar comic.

The comic direction was justified by the material — *Rychlé šípy* is a famous
Czech comic and the company stages it. That argument only ever covered one
production out of the repertoire. A poster language describes a company.

## Direction: poster press

The page is a stack of printed posters. Each section is a colour band, so
scrolling reads as flipping through a pile rather than sliding down a document.

Circus appears as **structure only** — no drawn tents, masks or balloons.

### Palette

Taken from the two colour boards in `inspiration/`, which independently
propose the same idea: a yellow-green ground, a red, and cream.

| Token | Hex | Use |
|---|---|---|
| `--cream` | `#FFFECD` | paper bands; text on deep red |
| `--olive` | `#B0BC68` | primary ground band |
| `--lime` | `#CDD78A` | lighter alternating band |
| `--red` | `#EB313F` | KP logo, display type, ribbons |
| `--cherry` | `#AA0A27` | red body text and links |
| `--ink` | `#1E1B14` | body text |

Two reds, for a measured reason. `#EB313F` on cream is roughly 4.2:1 — enough
for large display type, short of the 4.5:1 needed for body text. So punch red
is display-only and `#AA0A27` carries anything small. For the same reason cream
never sits on olive (roughly 2:1); olive and lime bands take ink text.

These are working values. Zuzka's final palette is still pending, so every
colour is a `:root` custom property and swapping her palette in is a one-block
edit.

### Type

The previous "no webfonts" rule is dropped. A poster direction cannot hold on a
system stack. Two self-hosted `woff2` files, no third-party requests.

Proposed pairing: **Archivo Black** for display, **Archivo** for body. One
superfamily, and it has genuine Czech coverage — which eliminates most deco
display faces, since `ě š č ř ž ů ť ď ň` are usually the first glyphs a display
font omits. Verify the diacritics render before committing.

The "COURAGE" look from the board comes from treatment rather than the face:
layered hard offset shadows in red and olive, a `text-shadow` step ladder that
works on any heavy weight. The per-letter jitter from the comic prototype is
removed — jitter is hand-drawn, and this direction is printed.

### Structural circus vocabulary

- **Perforated ticket edge** — date cards (`repeating-radial-gradient` mask)
- **Notched ribbon banner** — section headings (`clip-path`)
- **Arrow sign** — nav links and the scroll cue. This keeps the five *rychlé
  šípy* arrows alive as continuity with the old direction instead of losing them.
- **Star and diamond dividers** between bands
- **Alternating band grounds** — cream / olive / lime

## Structure

Sticky header: red KP monogram left, burger right. The burger opens a
full-screen overlay with the six items as large display type.

Section order follows the feedback exactly. Band grounds alternate so no two
adjacent sections share one, and the two reds are reserved for accent so a red
band never competes with the KP monogram.

| # | Section | Ground | Contents |
|---|---|---|---|
| 1 | Hero | olive | KP monogram, masthead, claim slot, pitch, venue line |
| 2 | Program | cream | ticket-stub date cards, empty state |
| 3 | Repertoár | lime | two production posters with press quotes |
| 4 | Soubor | cream | the ensemble |
| 5 | O nás | olive | prose |
| 6 | O prostoru | cream | Studio Citadela, address, trams |
| 7 | Fotky | lime | gallery strip |
| — | Footer | ink | links |

### Hero

Masthead "Kolekce Parchant" in stacked mixed-size poster type.

The claim under the logo is **an empty slot**. Zuzka has not sent it. It is not
the tagline below — the backlog lists them as separate items and we are
honouring that. Confirm with her.

Pitch, her own words:

> Divadelní soubor, který se nebojí provokovat. Jsme tu abychom bourali hranice
> a vytvářeli nezapomenutelné zážitky!

Venue line: Studio Citadela · Klimentská 16 · Praha 1

### Program

There are zero upcoming dates. The last performance was 2026-05-23 and the
client has not published autumn dates yet, so **the empty state is the normal
state at launch** and has to be designed as a real thing, not a fallback.

Copy: dates are announced on GoOut and appear here when they do.

GoOut is no longer our source of truth — the feedback says it is not under the
company's management and they will arrange their own. So the band renders from
a local `data/program.json` that we control. `scripts/fetch-goout.mjs` stays in
the repo as an optional refresh; nothing on the page depends on it running.

The October 2026 premiere listed on i-divadlo (*Ale ty červánky jsou stejně
nejkrásnější*, Barbora Hančilová) is **deliberately excluded** — the client
never mentioned it and we are not announcing it for her.

### Repertoár

Two productions. *Audience / Pivařská odysea* is omitted at the client's
explicit request.

**Rychlé šípy a záhada klubovny**

- Napsal Šimon Lorko, na motivy knih Jaroslava Foglara
- Režie a scéna: Prokop Zach · Hudba: Marek Cimbál
- Hrají: Prokop Zach, Maxmilián Kocek / Matouš Vyšata, Ondřej Stupka,
  Zuzana Matušková, Maximilián Dolanský
- Archivní nahrávky: Tomáš Turek, Roman Zach
- Premiéra 30. 1. 2026 · 1 h 15 min bez přestávky · 6+
- Her blurb: "záhada slavných Foglarových Rychlých šípů v nové size od
  designera Šimona Lorka." — *"size" is probably meant to be "verzi". Ask
  before publishing; do not silently correct her words.*

**Hra lásky a náhody**

- Pierre de Marivaux · Režie: Prokop Zach · Hudba: Marek Cimbál
- Hrají: Aliska, Jiří Dlouhý / Šimon Fikar, Ondřej Stupka, Zuzana Matušková,
  Maximilián Dolanský, Prokop Zach
- Premiéra 2. 5. 2025
- Her blurb: "klasická francouzská komedie z roku 1730 od Marivauxe v novém
  českém designu od KOLEKCE PARCHANT."

i-divadlo still lists Aneta Kalertová; the client asked for **Aliska**. Ours to
apply, theirs to fix upstream.

### Press quotes

A press-quote block: score, reviewer name, date, quote, link back to i-divadlo.
This is native to a theatre poster, so the client's "show the reviews
prominently" ask lands inside the direction rather than fighting it.

The two productions are asymmetric and the design accepts that:

- **Rychlé šípy** — real pull quotes. Hessy 90% (2026-03-20) and Mariematenova
  100% (2026-02-20) have text; Remcoe 70% (2026-05-26) does not.
- **Hra lásky a náhody** — score badge only. Madok gave 90% (2026-02-14) with
  no text. A badge reading "90 % · i-divadlo" linking back.

**The quotes must be pulled as Czech verbatim before use.** They were read
through a translating fetch, and these are real named people being quoted on a
public page.

### Soubor

From i-divadlo, being a better source than names read off a photograph of a
poster — but still not her own list, so this stays flagged for verification.

Prokop Zach (režie, hraje), Zuzana Matušková, Ondřej Stupka, Maximilián
Dolanský, Maxmilián Kocek, Matouš Vyšata, Aliska, Jiří Dlouhý, Šimon Fikar,
Šimon Lorko (text), Marek Cimbál (hudba).
Archivní nahrávky: Tomáš Turek, Roman Zach.

Three corrections against the current prototype: *Maxmilián* Kocek not
Maximilián, Matouš *Vyšata* not Višata, and **Mikuláš Polák is dropped** — he
appears nowhere on i-divadlo.

### O nás

Prose on cream. Her text is still pending, so the placeholder stays and is
marked as placeholder in the markup.

### O prostoru

Studio Citadela, Klimentská 16, Praha 1. Tram 6, 8, 15, 26 — Dlouhá třída.
The basement room, audience sitting on the floor a metre from the actors.

### Fotky

A horizontal strip of production photographs on the lime band.

The existing panels in `prototype/assets/panels/` are ink-posterized phone
shots, chosen to make amateur capture read as deliberate print. That treatment
belonged to the comic direction and does not survive into poster press.

A separate probe established that an image model redraws these stage photos as
inked panels for about four cents each, at a quality well above the posterize
filter — it reinterprets rather than filters, which is what fixes the real
problem with the source material (phone shots with audience heads across the
bottom third). That is the intended pipeline, replacing `scripts/make-panels.sh`.

Two constraints carried over from the current README and still unresolved:
only the *Rychlé šípy* photographs are identifiable, so nothing else may be
captioned with a production name; and the client plans a new shoot, after which
this pass is rerun.

### Footer

Instagram <https://www.instagram.com/kolekce_parchant>, the i-divadlo profile,
and GoOut for tickets. A Facebook page also exists
(<https://www.facebook.com/profile.php?id=61575422363010>) — not in the
feedback, so ask before adding it.

Target domain: kolekceparchant.cz

## Technical

Fresh single `prototype/index.html`, no build step, all tokens in `:root`.
`prototype/canvas.html` is left untouched as the record of the old direction;
deleting it is a separate decision.

**Content is written as real markup, not built in JavaScript.** This is the one
technical decision that carries weight beyond this page. The canvas prototype
built every cell in script, so nothing that does not execute JavaScript could
see any content — and the audience arrives from Instagram, where scrapers never
run JS, so every shared link previewed blank. Static markup plus Open Graph
tags plus schema.org `TheaterEvent` captures most of the value of the Astro
migration item on the backlog. Astro stays on the backlog for detail pages and
real routes; it stops being urgent.

Reduced motion is respected, as in the current prototype.

A `data-animate` hook is left on the hero image for the actor-motion video that
is being explored separately.

`scripts/publish-docs.sh` does `rm -rf docs`, so nothing may be authored inside
`docs/`. That is why this spec lives in `specs/`.

## Verification

There is no test framework in this repo and this design does not add one.
Verification is:

- `node scripts/shot.mjs` at 390px, 768px and 1440px
- the contrast ratios above, checked against the rendered values
- Czech diacritics rendering in the chosen display face
- Open Graph preview rendering

## Open questions for the client

1. The claim under the logo — still not sent, and is it separate from the
   tagline?
2. "v nové size" — did she mean "v nové verzi"?
3. The final palette and font from Zuzka.
4. The O nás prose.
5. Cast list confirmation, particularly Mikuláš Polák's absence and Aliska's
   full billing name.
6. Should the October premiere be announced?
7. Facebook in the footer alongside Instagram?
