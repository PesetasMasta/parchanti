// Shoot the masthead four ways, so the logo question gets answered from
// pictures rather than from a description.
//
// She asked to see it (2026-09-02): "Logo - zkus ho ve stejném fontu jako je
// vše ostatní jen výrazne a velká písmena." Cutive Mono is her own pick and
// ships at 400 with no bold, so "výrazně" has to come from size, tracking and
// colour rather than from weight.
//
// The variants are injected here rather than added to the stylesheet: "zkus"
// is a request to look, not a decision, and nothing should ship into every
// page's masthead until she has picked one. Whichever wins gets written into
// global.css properly and this file goes away.
//
//   node scripts/serve.mjs dist &
//   node scripts/shot-logo.mjs http://127.0.0.1:4173/ /tmp/logo
//
// Why the top line is tracked and the bottom one is not: the face is
// monospaced, so every glyph takes the same advance `a`. KOLEKCE is 7 glyphs
// and PARCHANT is 8, so the block only sets flush both sides at one exact
// value. With letter-spacing L the visible width is n*a + (n-1)*L, so
// 7a + 6L = 8a gives L = a/6 = 0.1667em, and the trailing space is pulled back
// off the right edge. That is the whole idea: a typed block that squares up
// because the tracking was computed, not eyeballed.

import { writeFile } from 'node:fs/promises';
import { withPage } from './lib/browser.mjs';

const [url, prefix = '/tmp/logo', width = '390', height = '260'] = process.argv.slice(2);
if (!url) {
  console.error('usage: node scripts/shot-logo.mjs <url> [prefix] [width] [height]');
  process.exit(1);
}

// The two-line block, shared by every variant that uses it.
const STAMP = `
  .masthead__name {
    display: grid;
    font-family: var(--display);
    text-transform: uppercase;
    line-height: 0.98;
    letter-spacing: 0;
  }
  .masthead__name > span:first-child {
    letter-spacing: 0.1667em;
    margin-right: -0.1667em;
  }
`;

const VARIANTS = {
  // What ships today: her drawn KP beside the name in mixed case.
  current: '',

  // The literal reading of her ask - the name alone, set in the site's own
  // face, uppercase, in the logo's red so it reads as a logo and not a
  // heading. Her drawing is gone.
  stamp: `${STAMP}
    .masthead__home svg { display: none; }
    .masthead__name {
      font-size: clamp(1.15rem, 6vw, 2.1rem);
      color: var(--brick);
    }
  `,

  // The same block with her drawing kept beside it. The compromise: she gets
  // the typed wordmark and the mark she drew stays part of the lockup.
  'stamp-mark': `${STAMP}
    .masthead__name {
      font-size: clamp(0.95rem, 4.6vw, 1.6rem);
      color: var(--ink);
    }
  `,

  // The monogram set in type rather than drawn, reversed out of a brick chip
  // with the site's own 3px rule and button radius - a stamp on a programme.
  // Type doing both jobs, which is the fullest reading of "ve stejném fontu
  // jako je vše ostatní".
  'stamp-box': `${STAMP}
    .masthead__home svg { display: none; }
    .masthead__home::before {
      content: "KP";
      font-family: var(--display);
      font-size: calc(var(--masthead-logo) * 0.62);
      line-height: 1;
      padding: 0.12em 0.24em 0.2em;
      color: var(--button-text);
      background: var(--brick);
      background-clip: padding-box;
      border: 3px solid var(--ink);
      border-radius: var(--radius-button);
    }
    .masthead__name {
      font-size: clamp(0.95rem, 4.6vw, 1.6rem);
      color: var(--ink);
    }
  `,
};

await withPage(url, { width: Number(width), height: Number(height) }, async (evaluate, screenshot) => {
  for (const [variant, css] of Object.entries(VARIANTS)) {
    await evaluate(`(() => {
      document.querySelector('#logo-variant')?.remove();
      const name = document.querySelector('.masthead__name');
      // "current" is what ships, so it is restored rather than styled - the
      // screenshot then shows exactly the bar the site serves today.
      name.innerHTML = ${JSON.stringify(variant)} === 'current'
        ? 'Kolekce Parchant'
        : '<span>Kolekce</span><span>Parchant</span>';
      const style = document.createElement('style');
      style.id = 'logo-variant';
      style.textContent = ${JSON.stringify(css)};
      document.head.append(style);
      return true;
    })()`);

    const out = `${prefix}-${variant}.png`;
    await writeFile(out, await screenshot());
    console.log(`${out}  ${await evaluate("document.querySelector('.masthead').getBoundingClientRect().height + 'px bar'")}`);
  }
});
