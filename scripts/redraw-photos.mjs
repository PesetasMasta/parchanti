// Redraw stage photographs as inked poster panels.
//
// Replaces make-panels.sh. The old pipeline posterized phone shots to two inks
// to make amateur capture read as deliberate print. This reinterprets instead
// of filtering, which is what actually fixes the source material: these are
// phone photos with audience heads across the bottom third.
//
// About $0.04 per image on gemini-2.5-flash-image, roughly 9 seconds each.
//
//   node scripts/redraw-photos.mjs ~/Downloads/parchant [out-dir] [--force]
//
// By default an existing file at the destination is left alone and skipped,
// since the default out-dir is the site's live panels folder. Pass --force
// to overwrite.

import { readdir, readFile, writeFile, mkdir, access } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MODEL = 'google/gemini-2.5-flash-image';

const force = process.argv.includes('--force');
const positional = process.argv.slice(2).filter((arg) => arg !== '--force');
const source = positional[0];
const outDir = positional[1] ?? fileURLToPath(new URL('../prototype/assets/panels/', import.meta.url));

if (!source) {
  console.error('usage: node scripts/redraw-photos.mjs <source-dir> [out-dir] [--force]');
  process.exit(1);
}
if (!process.env.OPENROUTER_API_TOKEN) {
  console.error('OPENROUTER_API_TOKEN is not set');
  process.exit(1);
}

const files = (await readdir(source))
  .filter((name) => /\.(jpe?g|png)$/i.test(name))
  .sort();

if (files.length === 0) {
  console.error(`no images in ${source}`);
  process.exit(1);
}

// The palette is named explicitly so redrawn panels sit inside the page's own
// colour world rather than arriving with their own.
const PROMPT = [
  'Redraw this stage photograph as a flat two-colour screen-print or woodcut poster panel.',
  'Two colours only: a pale cream ground (#FFFECD) and a near-black ink line (#1E1B14).',
  'Hard, decisive edges. Large untouched areas of flat cream and large areas of solid unhatched ink.',
  'Where shadow needs marking, use sparse, widely-spaced hatching only, at most two crossing line directions, never a dense or fine weave.',
  'Marks must stay individually legible at normal viewing size, not blend into a mid-tone.',
  'No fine cross-hatching, no stippling, no engraving texture, no gradients, no grey tones.',
  'Keep every figure, their poses and their costumes exactly as photographed.',
  'Mid-century screen-printed poster, slightly off-register, not a pen-and-ink illustration.',
  'Do not add a border, a caption, lettering or a signature.',
].join(' ');

// The model can refuse to draw an image: the response comes back with
// choices[0].finish_reason === 'content_filter' and no image, instead of an
// HTTP error. This appears not to be charged — inferred from the response's
// own cost field reading 0 on a refusal, not confirmed against actual
// billing — so treat that as a working assumption, not a fact. It is also
// non-deterministic — the same photo can be refused once and pass on a later
// run — and stage photographs that include a prop weapon are the likely
// trigger for this company's material. Flagged distinctly below (REFUSED,
// not FAILED) so a batch run makes clear which frames are worth simply
// re-running.
class ContentFilterRefusal extends Error {}

const MIME_TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png' };

function mimeTypeFor(path) {
  const type = MIME_TYPES[extname(path).toLowerCase()];
  if (!type) throw new Error(`unrecognised image extension: ${path}`);
  return type;
}

async function redraw(path) {
  const image = await readFile(path);
  const mimeType = mimeTypeFor(path);
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      modalities: ['image', 'text'],
      messages: [{
        role: 'user',
        content: [
          { type: 'text', text: PROMPT },
          { type: 'image_url', image_url: { url: `data:${mimeType};base64,${image.toString('base64')}` } },
        ],
      }],
    }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body).slice(0, 300));

  const url = body.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) {
    if (body.choices?.[0]?.finish_reason === 'content_filter') {
      throw new ContentFilterRefusal('refused by the model\'s content filter (not charged) — safe to retry, may pass next time');
    }
    throw new Error(`no image came back: ${JSON.stringify(body).slice(0, 300)}`);
  }

  return { png: Buffer.from(url.split(',')[1], 'base64'), cost: body.usage?.cost ?? 0 };
}

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

await mkdir(outDir, { recursive: true });

let spent = 0;
let written = 0;
for (const file of files) {
  const out = join(outDir, `${basename(file, extname(file))}.png`);

  if (!force && await exists(out)) {
    console.log(`${out}  SKIPPED (already exists, pass --force to overwrite)`);
    continue;
  }

  try {
    const { png, cost } = await redraw(join(source, file));
    await writeFile(out, png);
    spent += cost;
    written += 1;
    console.log(`${out}  $${cost.toFixed(4)}`);
  } catch (error) {
    // One bad frame must not lose the rest of the run, each of which cost money.
    const label = error instanceof ContentFilterRefusal ? 'REFUSED' : 'FAILED';
    console.error(`${file}  ${label}  ${error.message}`);
  }
}

// Four decimal places, matching the per-image line above: a small batch at
// ~$0.04 each would round to $0.00 at two decimal places and look like
// nothing was spent.
console.log(`\ntotal $${spent.toFixed(4)} across ${written} image(s) written (${files.length} considered)`);
