// Inline every local asset into one HTML file.
// Needed because the sharing target blocks requests to external hosts, so the
// page has to carry its own images as data URIs.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = join(ROOT, 'prototype', 'index.html');
const TARGET = join(ROOT, 'build', 'parchant.html');

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

const references = [...html.matchAll(/src="(\.\/[^"]+)"/g)].map((match) => match[1]);
const unique = [...new Set(references)];

let inlined = html;
for (const reference of unique) {
  const dataUri = await toDataUri(reference);
  inlined = inlined.replaceAll(`src="${reference}"`, `src="${dataUri}"`);
}

await mkdir(dirname(TARGET), { recursive: true });
await writeFile(TARGET, inlined);

const megabytes = (Buffer.byteLength(inlined) / 1024 / 1024).toFixed(2);
console.log(`Inlined ${unique.length} assets into build/parchant.html (${megabytes} MB)`);
