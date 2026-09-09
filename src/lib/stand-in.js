// A photograph standing in for a poster we do not have yet.
//
// This reverses a rule the repo held until 2026-09-09, written into
// content.config.ts, PerformanceDate.astro and fotky.astro: "a photo panel is
// not a substitute for a poster", and a grey blank was shown instead. The
// developer's call is that four blanks on a page that is about to go public
// read as unfinished where a photograph reads as a company that works, and
// that a labelled photograph claims nothing a blank does not.
//
// The label is the load-bearing half. A group photograph sitting in a poster
// slot, unlabelled, says "this is what Červánky looks like" - which is exactly
// the misattribution this repo guards hardest against, and which the blank
// could never commit. So every stand-in is rendered under a "Připravujeme"
// bubble, and its alt text says the company, never the production.

// Only the shots that read as the company rather than as a named show.
// Deliberately NOT ensemble.png or cardboard.png: both carry the Rychlé šípy
// clubhouse - the CAFÉ DO BRASIL sign in one, the KLUBOVNA prop in the other -
// so either would attribute a different production's set to whatever it stood
// in for. sipy-*.png are out for the same reason, and more obviously.
const PANELS = [
  {
    src: '/assets/panels/hero.png',
    width: 1400,
    height: 1077,
    alt: 'Soubor Kolekce Parchant: šest herců stojí vedle sebe v řadě v podkroví s lany a petrolejkou nad hlavou.',
  },
  {
    src: '/assets/panels/scene.png',
    width: 900,
    height: 675,
    alt: 'Soubor Kolekce Parchant: skupina herců se sklání nad sedící postavou v prostoru se svítidly u stropu.',
  },
  {
    src: '/assets/panels/hra.png',
    width: 1000,
    height: 833,
    alt: 'Soubor Kolekce Parchant: pět herců stojí vedle sebe v tmavém interiéru a smějí se do strany.',
  },
];

// Stable, not random. The same title has to draw the same photograph on every
// build: check.mjs asserts declared image dimensions against the files it
// finds, and a page that reshuffles itself between the build and the check is
// a flaky suite rather than a livelier page. It also means the strip and the
// repertoire deck agree about which photograph belongs to which title, which
// Math.random() on each call would not.
function hash(text) {
  let value = 0;
  for (const character of text) value = (value * 31 + character.codePointAt(0)) % 0xffffffff;
  return value;
}

export function standIn(title) {
  return PANELS[hash(title) % PANELS.length];
}
