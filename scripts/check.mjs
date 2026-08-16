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
