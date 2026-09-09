// A drawn placeholder where a portrait photograph will go.
//
// Thirteen of the fifteen people have no photograph yet. A grey block said so
// honestly but said it thirteen times, and read as a page that had not been
// finished rather than as one waiting for a shoot.
//
// What this is NOT, deliberately: a stock photograph of a person. An
// open-licence headshot of a stranger placed under a named actor is the worst
// version of the misattribution this repo guards everywhere else - it looks
// exactly like a photograph of that person, which is the one thing a
// placeholder must never do. A halftone silhouette cannot be mistaken for
// anybody, which is what makes it safe to give everyone their own.
//
// Each is generated from the person's own id, so it is stable across builds,
// unique to them, and needs no files: the SVG is inlined, so there is nothing
// to download, nothing to keep in sync with the people data, and nothing for
// the harness's image-dimension check to disagree with.

// A small deterministic generator. The same id always draws the same face.
function seedFrom(id) {
  let value = 2166136261;
  for (const character of id) {
    value ^= character.codePointAt(0);
    value = Math.imul(value, 16777619);
  }
  return value >>> 0;
}

function generator(seed) {
  let state = seed || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

const WIDTH = 300;
const HEIGHT = 400;
const STEP = 13;

const clamp = (value) => Math.min(1, Math.max(0, value));

// Head and shoulders, as two soft fields rather than as an outline: the dots
// thin out towards the edge instead of stopping at one, which is what makes it
// read as printed rather than as clip art.
function coverageAt(x, y, face) {
  const head = Math.hypot(x - face.headX, y - face.headY) / face.headR;
  const body = Math.hypot((x - WIDTH / 2) / face.bodyRX, (y - HEIGHT * 1.02) / face.bodyRY);
  // Without this the head floats above the shoulders as a ball over a
  // triangle. The neck is what makes the three fields read as one person.
  const neck = Math.hypot(
    (x - face.headX) / (face.headR * 0.45),
    (y - (face.headY + face.headR * 0.9)) / (face.headR * 0.6),
  );
  return clamp(1.22 - Math.min(head, body, neck));
}

// Evenly spaced round the wheel, by position in the roster rather than by a
// hash of the name: a hash puts two people on neighbouring hues sooner or
// later, and the whole point is that no two of these look alike.
//
// THESE HUES ARE OURS AND ARBITRARY. The plan on record is that every actor
// gets a colour of their own and picks it; this is a placeholder standing in
// for that, not a proposal about who gets which. It is legal at any hue
// because the colour is a graphic and never text - it answers to 3:1, not to
// the 4.5:1 that would rule most of these out.
function hueFor(index) {
  // The golden angle, not an even slice of the wheel. Fifteen evenly spaced
  // hues put 24 degrees between neighbours, and 24 degrees inside the greens
  // is not a difference anyone sees - three people in a row came out the same
  // green. Stepping by 137.5 degrees still covers the wheel evenly overall but
  // sends each person far from the one before them, which is what "each has
  // their own" has to mean when they are read side by side in a grid.
  return Math.round(index * 137.508 + 18) % 360;
}

export function placeholderPortrait(id, index = 0) {
  const random = generator(seedFrom(id));
  const hue = hueFor(index);

  // The differences between one person and the next: how big the head is,
  // where it sits, how broad the shoulders are. Small ranges on purpose - they
  // have to look like one set, not like thirteen different ideas.
  const face = {
    headX: WIDTH / 2 + (random() - 0.5) * 26,
    headY: 132 + (random() - 0.5) * 20,
    headR: 62 + random() * 14,
    bodyRX: 118 + random() * 30,
    bodyRY: 150 + random() * 40,
  };

  const dots = [];
  for (let y = STEP / 2; y < HEIGHT; y += STEP) {
    for (let x = STEP / 2; x < WIDTH; x += STEP) {
      const coverage = coverageAt(x, y, face);
      if (coverage <= 0.02) continue;
      // The jitter is what stops thirteen halftones looking like one halftone
      // shifted sideways.
      const radius = (STEP / 2) * coverage * (0.55 + 0.45 * random());
      if (radius < 0.4) continue;
      dots.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${radius.toFixed(2)}"/>`);
    }
  }

  // Seen through milky glass (2026-09-09): the figure is a soft colour field
  // behind a white veil, with the halftone printed on the glass in front of
  // it. Three layers, and the order is the whole effect - a blurred colour
  // that has not been veiled looks like a mistake, and dots behind the veil
  // stop reading as ink.
  const blur = `blur-${id}`;

  return `<svg class="ensemble__portrait ensemble__portrait--drawn" viewBox="0 0 ${WIDTH} ${HEIGHT}" `
    + `preserveAspectRatio="xMidYMid slice" data-placeholder aria-hidden="true" focusable="false">`
    + `<defs><filter id="${blur}" x="-30%" y="-30%" width="160%" height="160%">`
    + `<feGaussianBlur stdDeviation="17"/></filter></defs>`
    + `<rect width="${WIDTH}" height="${HEIGHT}" fill="hsl(${hue} 42% 92%)"/>`
    + `<g filter="url(#${blur})" fill="hsl(${hue} 62% 52%)">`
    + `<circle cx="${face.headX.toFixed(1)}" cy="${face.headY.toFixed(1)}" r="${face.headR.toFixed(1)}"/>`
    + `<ellipse cx="${(WIDTH / 2).toFixed(1)}" cy="${(HEIGHT * 1.02).toFixed(1)}" `
    + `rx="${face.bodyRX.toFixed(1)}" ry="${face.bodyRY.toFixed(1)}"/>`
    + `<rect x="${(face.headX - face.headR * 0.42).toFixed(1)}" y="${face.headY.toFixed(1)}" `
    + `width="${(face.headR * 0.84).toFixed(1)}" height="${(face.headR * 1.5).toFixed(1)}"/>`
    + `</g>`
    + `<rect width="${WIDTH}" height="${HEIGHT}" fill="#FFFFFF" opacity="0.42"/>`
    + `<g fill="var(--ink)" opacity="0.5">${dots.join('')}</g>`
    + `</svg>`;
}
