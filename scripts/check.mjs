// Assertion harness for the prototype page.
//
// There is no test framework here on purpose: the deliverable is one static
// HTML file with no dependencies, and a runner that needs npm install would be
// heavier than the thing it tests. This drives a real browser instead, so the
// assertions run against computed styles and real layout rather than a parsed
// string.
//
//   node scripts/check.mjs [url]

import { withPage } from './lib/browser.mjs';

const url = process.argv[2]
  ?? new URL('../prototype/index.html', import.meta.url).href;

const checks = [];

function check(name, expression, verify) {
  checks.push({ name, expression, verify });
}

check(
  'page has a title',
  `document.title`,
  (title) => (title && title.trim().length > 0 ? null : `title was ${JSON.stringify(title)}`),
);

check(
  'Czech diacritics render in the display face',
  `(async () => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;font-size:64px;white-space:pre';
    document.body.append(probe);
    const widthOf = (text, family) => {
      probe.style.fontFamily = family;
      probe.textContent = text;
      return probe.getBoundingClientRect().width;
    };
    // If the face lacks a glyph the browser substitutes from the fallback, and
    // the substituted run measures differently from the same string rendered
    // in the fallback alone only when the face DOES have it. Comparing the
    // diacritic string against a plain one in both families catches the swap.
    //
    // Nothing else on the page references these families before this probe
    // does, so without an explicit load the first measurement always races
    // the async @font-face fetch and reads fallback metrics regardless of
    // whether the face actually has the glyphs. document.fonts.load() forces
    // the font to be fetched and ready before we measure.
    const result = {};
    for (const family of ['"Archivo Black"', '"Archivo"']) {
      await document.fonts.load('64px ' + family, 'ěščřžůťďň');
      const withDiacritics = widthOf('ěščřžůťďň', family + ', monospace');
      const fallbackOnly = widthOf('ěščřžůťďň', 'monospace');
      result[family] = withDiacritics !== fallbackOnly;
    }
    probe.remove();
    return JSON.stringify(result);
  })()`,
  (raw) => {
    const result = JSON.parse(raw);
    const missing = Object.entries(result).filter(([, ok]) => !ok).map(([family]) => family);
    return missing.length ? `no Czech glyphs in ${missing.join(', ')}` : null;
  },
);

const failures = await withPage(url, { width: 390, height: 844 }, async (evaluate) => {
  const failed = [];
  for (const { name, expression, verify } of checks) {
    let problem;
    try {
      problem = verify(await evaluate(expression));
    } catch (error) {
      problem = error.message;
    }
    console.log(`${problem ? 'FAIL' : 'pass'}  ${name}${problem ? ` — ${problem}` : ''}`);
    if (problem) failed.push(name);
  }
  return failed;
});

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log('\nall checks passed');
