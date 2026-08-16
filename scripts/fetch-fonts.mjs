// Download the woff2 subsets the page needs and emit an @font-face block.
//
// Fonts are self-hosted rather than linked: the page must make no third-party
// requests, and it has to work from file:// as well as from a host.
//
// Google's css2 endpoint serves different formats per user agent, so a browser
// UA is required to get woff2 rather than ttf.
//
//   node scripts/fetch-fonts.mjs

import { mkdir, writeFile } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
  + 'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const OUT = new URL('../prototype/assets/fonts/', import.meta.url);

// Czech needs latin-ext (ě š č ř ž ů ť ď ň live in U+0100-017F) as well as
// latin. Every other subset the endpoint offers is dropped.
const WANTED = ['latin', 'latin-ext'];

const FAMILIES = [
  { query: 'Archivo+Black', family: 'Archivo Black', weight: '400', file: 'archivo-black' },
  { query: 'Archivo:wght@400..700', family: 'Archivo', weight: '400 700', file: 'archivo' },
];

await mkdir(OUT, { recursive: true });

const faces = [];

for (const { query, family, weight, file } of FAMILIES) {
  const css = await fetch(
    `https://fonts.googleapis.com/css2?family=${query}&display=swap`,
    { headers: { 'User-Agent': UA } },
  ).then((response) => response.text());

  // Each @font-face is preceded by a /* subset */ comment.
  const blocks = css.split('/*').slice(1);

  for (const block of blocks) {
    const subset = block.slice(0, block.indexOf('*/')).trim();
    if (!WANTED.includes(subset)) continue;

    const url = block.match(/https:\/\/[^)]+\.woff2/)?.[0];
    const range = block.match(/unicode-range:\s*([^;]+);/)?.[1]?.trim();
    if (!url || !range) throw new Error(`could not parse the ${subset} block for ${family}`);

    const name = `${file}-${subset}.woff2`;
    const bytes = Buffer.from(await fetch(url).then((response) => response.arrayBuffer()));
    await writeFile(new URL(name, OUT), bytes);
    console.log(`${name}  ${(bytes.length / 1024).toFixed(1)} kB`);

    faces.push(
      `@font-face {\n`
      + `  font-family: "${family}";\n`
      + `  font-style: normal;\n`
      + `  font-weight: ${weight};\n`
      + `  font-display: swap;\n`
      + `  src: url("assets/fonts/${name}") format("woff2");\n`
      + `  unicode-range: ${range};\n`
      + `}`,
    );
  }
}

console.log(`\nPaste into prototype/index.html:\n\n${faces.join('\n\n')}\n`);
