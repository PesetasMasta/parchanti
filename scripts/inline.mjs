// Inline every local asset into one HTML file.
// Needed because the sharing target blocks requests to external hosts, so the
// page has to carry its own images as data URIs.

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const NAME = process.argv[2] ?? 'index';
const SOURCE = join(ROOT, 'prototype', `${NAME}.html`);
const TARGET = join(ROOT, 'build', NAME === 'index' ? 'parchant.html' : `parchant-${NAME}.html`);

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml' };

async function toDataUri(relativePath) {
  const absolute = resolve(dirname(SOURCE), relativePath);
  const extension = absolute.slice(absolute.lastIndexOf('.')).toLowerCase();
  const mime = MIME[extension];
  if (!mime) throw new Error(`No MIME type known for ${relativePath}`);

  const bytes = await readFile(absolute);
  return `data:${mime};base64,${bytes.toString('base64')}`;
}

const html = await readFile(SOURCE, 'utf8');
let inlined = html;

// Pages that reference assets as src="./..." attributes.
const references = [...html.matchAll(/src="(\.\/[^"]+)"/g)].map((match) => match[1]);
const unique = [...new Set(references)];
for (const reference of unique) {
  const dataUri = await toDataUri(reference);
  inlined = inlined.replaceAll(`src="${reference}"`, `src="${dataUri}"`);
}

// Pages that build asset paths in script and read them from an asset map.
const START = '/* ASSETS:START */';
const END = '/* ASSETS:END */';
let mapped = 0;
if (html.includes(START)) {
  const directory = join(ROOT, 'prototype', 'assets', 'panels');
  const files = (await readdir(directory)).filter((file) => MIME[file.slice(file.lastIndexOf('.')).toLowerCase()]);

  const map = {};
  for (const file of files) map[file] = await toDataUri(`./assets/panels/${file}`);
  mapped = files.length;

  const from = inlined.indexOf(START);
  const to = inlined.indexOf(END);
  inlined = inlined.slice(0, from + START.length) + '\n' + JSON.stringify(map) + '\n' + inlined.slice(to);
}

await mkdir(dirname(TARGET), { recursive: true });
await writeFile(TARGET, inlined);

const megabytes = (Buffer.byteLength(inlined) / 1024 / 1024).toFixed(2);
console.log(`Inlined ${unique.length + mapped} assets into ${TARGET.replace(ROOT + '/', '')} (${megabytes} MB)`);
