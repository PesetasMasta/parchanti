// Photograph both termíny frame variants from one build, so the client picks
// from a picture rather than from a description.
//
// She gave two options and no preference (2026-08-31, item 2: "Barva rámu na
// terminy (bílá anebo vpít zelenou a červenou)"). Both live in the CSS behind
// data-ticket-frame on <html>, so this flips the attribute in the page and
// shoots each rather than rebuilding twice.
//
//   node scripts/serve.mjs dist &
//   node scripts/shot-frames.mjs http://127.0.0.1:4000/program/ /tmp/frame

import { writeFile } from 'node:fs/promises';
import { withPage } from './lib/browser.mjs';

const [url, prefix = 'frame', width = '390', height = '844'] = process.argv.slice(2);
if (!url) {
  console.error('usage: node scripts/shot-frames.mjs <url> [out-prefix] [width] [height]');
  process.exit(1);
}

await withPage(url, { width: Number(width), height: Number(height) }, async (evaluate, screenshot) => {
  for (const variant of ['white', 'duo']) {
    // "white" is the stylesheet default, so the attribute is removed rather
    // than set to it - that way the screenshot shows exactly what ships.
    await evaluate(variant === 'white'
      ? `(document.documentElement.removeAttribute('data-ticket-frame'), 'white')`
      : `(document.documentElement.dataset.ticketFrame = 'duo')`);

    const out = `${prefix}-${variant}.png`;
    await writeFile(out, await screenshot());
    console.log(`${out}  ${await evaluate("getComputedStyle(document.querySelector('.ticket')).borderTopColor")}`);
  }
});
