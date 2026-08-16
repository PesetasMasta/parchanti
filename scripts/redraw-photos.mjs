// Redraw stage photographs as inked poster panels.
//
// Replaces make-panels.sh. The old pipeline posterized phone shots to two inks
// to make amateur capture read as deliberate print. This reinterprets instead
// of filtering, which is what actually fixes the source material: these are
// phone photos with audience heads across the bottom third.
//
// About $0.04 per image on gemini-2.5-flash-image, roughly 9 seconds each.
//
//   node scripts/redraw-photos.mjs ~/Downloads/parchant [out-dir]

import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';

const MODEL = 'google/gemini-2.5-flash-image';

const source = process.argv[2];
const outDir = process.argv[3] ?? new URL('../prototype/assets/panels/', import.meta.url).pathname;

if (!source) {
  console.error('usage: node scripts/redraw-photos.mjs <source-dir> [out-dir]');
  process.exit(1);
}
if (!process.env.OPENROUTER_API_TOKEN) {
  console.error('OPENROUTER_API_TOKEN is not set');
  process.exit(1);
}

// The palette is named explicitly so redrawn panels sit inside the page's own
// colour world rather than arriving with their own.
const PROMPT = [
  'Redraw this stage photograph as a hand-inked poster panel.',
  'Two colours only: a pale cream ground (#FFFECD) and a near-black ink line (#1E1B14).',
  'Bold uneven brush outlines, hatching for shadow, no grey tones, no gradients.',
  'Keep every figure, their poses and their costumes exactly as photographed.',
  'Mid-century printed poster, slightly off-register.',
  'Do not add a border, a caption, lettering or a signature.',
].join(' ');

async function redraw(path) {
  const image = await readFile(path);
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
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${image.toString('base64')}` } },
        ],
      }],
    }),
  });

  const body = await response.json();
  if (!response.ok) throw new Error(JSON.stringify(body).slice(0, 300));

  const url = body.choices?.[0]?.message?.images?.[0]?.image_url?.url;
  if (!url) throw new Error(`no image came back: ${JSON.stringify(body).slice(0, 300)}`);

  return { png: Buffer.from(url.split(',')[1], 'base64'), cost: body.usage?.cost ?? 0 };
}

await mkdir(outDir, { recursive: true });

const files = (await readdir(source))
  .filter((name) => /\.(jpe?g|png)$/i.test(name))
  .sort();

if (files.length === 0) {
  console.error(`no images in ${source}`);
  process.exit(1);
}

let spent = 0;
for (const file of files) {
  const out = join(outDir, `${basename(file, extname(file))}.png`);
  try {
    const { png, cost } = await redraw(join(source, file));
    await writeFile(out, png);
    spent += cost;
    console.log(`${out}  $${cost.toFixed(4)}`);
  } catch (error) {
    // One bad frame must not lose the rest of the run, each of which cost money.
    console.error(`${file}  FAILED  ${error.message}`);
  }
}

console.log(`\ntotal $${spent.toFixed(2)} across ${files.length} image(s)`);
