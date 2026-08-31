# Feedback round 2026-08-31

Source: `FEEDBACK.md` section `260831` (13 numbered items plus the O nás text,
the company roster and the colour note). Backlog:
`~/dev/project-manager/projects/parchanti.yaml`.

## What ships this round

**Data**

1. `data/program.json` gains `date` (ISO) and `time` per entry. `when` stays
   exactly as she wrote it and becomes a checked duplicate: `check.mjs` derives
   the Czech string from `date` + `time` and fails if the two disagree. That is
   what stops a weekday drifting away from its date, and what lets the homepage
   pick the next date still to be played instead of `dates[0]`.
2. `content.config.ts`: `titleRest` becomes optional (a production whose whole
   name is the heading carries one string); `durationMinutes`, `ageRating` and
   `poster` become real fields; people gain `group` (`soubor` / `host`) and an
   optional `portrait`.
3. `people.json` is replaced by her roster, in her order, with her role
   strings. Four people return or arrive: Mikuláš Polák, Ondřej Kapusta,
   Roman Zach, Tomáš Turek. Polák was removed on her earlier instruction and is
   back as a guest — her call, so his name comes out of the forbidden list in
   `check.mjs`.
4. Productions: šípy 60 min / 0+ / Ondřej Kapusta in the cast; Hra lásky 12+
   (running time not known, asked); lights credited to Marek Cimbál on both;
   "Archivní nahrávky" becomes "Hlas ze záznamu"; Hra lásky drops `titleRest`.

**Components**

5. `PerformanceDate.astro` — one block for the homepage and the program page:
   title, time and date stacked, mini poster beside them, running time and age
   underneath. Built once, used twice, because she described the same block in
   items 3 and 5.
6. `ProductionTitle.astro` — the lead/rest split in one place, so
   "Hra lásky a náhody" reads as one heading on all three pages that set it.

**Pages**

7. O nás → **O Kolekci Parchant** (heading, `<title>`, menu label) with her
   text published verbatim, placeholder gone.
8. /soubor/ → two columns, Soubor and Hosté under their own headings, portrait
   over name over function, no frames. Portraits are placeholder blocks until
   real ones arrive.
9. /program/ and homepage → the shared date block; the accessibility line
   ("prostor není bezbariérový") on /program/ and /o-prostoru/.
10. Homepage → "Nejbližší představení" selects the next date not yet played.
11. Frames: cherry on the production cards (item 4, unambiguous). The termíny
    frame ships as two variants — white, and olive+cherry — for her to pick
    from a screenshot (item 2 gave both).
12. Menu → a "Zpět" control running `history.back()`, hidden when there is no
    history to return to.

**Checks** — `check.mjs` grows with the work: derived-date agreement, the next
date is never in the past, the roster is 15 people in two groups, /soubor/
carries no frames, O nás holds her text and no placeholder, Hra lásky renders
as a single heading.

## What does not ship, and why

| Item | Blocked on |
|---|---|
| Palette repaint from the Instagram logo | The logo file. A compressed feed image is not a colour source and the account cannot be read logged out. |
| Portraits, incl. Roman Zach and Tomáš Turek | Nothing lawful to use. Sourcing was settled 2026-08-17. Answer, do not quietly drop: ask each of them for one photo. |
| Mini poster artwork | She has them (they are the Instagram grid); the repo has none. Block renders a marked placeholder meanwhile. |
| Claim under the logo | Still pending from her. |
| Hra lásky running time | Not in any source. Ask. |
| Fotky thumbnails + lightbox | She conditioned it on the new shoot. |
| Domain move, noindex lift | Separate decision, after this round. |

## Questions for the next QA round

1. Šimon Lorko is on neither list — drop him from the roster, or oversight?
   He stays under Hosté meanwhile.
2. Running time for Hra lásky a náhody.
3. Poster artwork per production, for the mini plakát she asked for.
4. Roman Zach and Tomáš Turek: one photo each, from them, as for everyone else.
5. Termíny frame: white or olive+cherry, from the screenshot.
6. Three slips in her O nás text, left as written: "v dob jeho studií",
   "To se pomohlo s pomocí herce", and the missing comma in "Max Dolanský
   Zuzana Matušková".
7. Toníkova cesta and Červánky still have no page, so no duration, age or
   poster on their dates.
