// Screenshot a page at a real phone viewport.
//
//   node scripts/shot.mjs <url> <out.png> [width] [height]

import { writeFile } from 'node:fs/promises';
import { withPage } from './lib/browser.mjs';

const [url, out, width = '390', height = '844'] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: node scripts/shot.mjs <url> <out.png> [width] [height]');
  process.exit(1);
}

await withPage(url, { width: Number(width), height: Number(height) }, async (evaluate, screenshot) => {
  await writeFile(out, await screenshot());
  console.log(`${out}  ${await evaluate('innerWidth + "x" + innerHeight')}`);
});
