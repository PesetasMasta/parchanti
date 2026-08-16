# Poster-Press Scroll Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the pannable comic-canvas prototype with a single scrolling poster-press page for the theatre company Kolekce Parchant.

**Architecture:** One hand-written `prototype/index.html` with all content as static markup, all colour and type decisions as `:root` custom properties, and no build step or framework. Verification runs through a headless Brave instance driven over the DevTools protocol, reusing the pattern already in `scripts/shot.mjs`. Self-hosted fonts, no third-party requests at runtime.

**Tech Stack:** Vanilla HTML/CSS/JS, Node ESM scripts with zero dependencies, Brave headless over CDP, OpenRouter image API for the photo pipeline.

**Spec:** `specs/2026-08-16-poster-press-scroll-design.md`

## Global Constraints

- **Plans and specs never live in `docs/`.** `scripts/publish-docs.sh` runs `rm -rf docs`. Authoring anything there destroys it.
- **Language:** all user-facing copy is Czech. All code comments and commit messages are English.
- **No emoji anywhere**, including as status glyphs.
- **No runtime dependencies and no third-party requests.** Fonts are self-hosted. No CDN, no Google Fonts link tag, no analytics.
- **Every colour and font goes through a `:root` custom property.** Zuzka's final palette and font are still pending; swapping them must be a single-block edit.
- **Contrast rules, non-negotiable:** `--red` (`#EB313F`) is display-type only. Small or body-weight red text uses `--cherry` (`#AA0A27`). Cream text never sits on olive or lime; those bands take `--ink`.
- **Content is static markup.** No section may be built by JavaScript. Social scrapers do not run JS and the audience arrives from Instagram.
- **Placeholder copy must be marked in the markup** with `data-placeholder` so it is greppable before launch.
- **Unverified facts stay out.** The October 2026 premiere is excluded. Cast names carry a verification comment.
- **`prototype/canvas.html` is not modified or deleted** by this plan.

### Palette (exact values)

```css
--cream:  #FFFECD;
--olive:  #B0BC68;
--lime:   #CDD78A;
--red:    #EB313F;
--cherry: #AA0A27;
--ink:    #1E1B14;
```

### Band assignment (exact)

| # | Section id | Ground |
|---|---|---|
| 1 | `hero` | olive |
| 2 | `program` | cream |
| 3 | `repertoar` | lime |
| 4 | `soubor` | cream |
| 5 | `o-nas` | olive |
| 6 | `o-prostoru` | cream |
| 7 | `fotky` | lime |
| — | `footer` | ink |

---

## File Structure

| File | Responsibility |
|---|---|
| `scripts/lib/browser.mjs` | Create: CDP plumbing — boot Brave, navigate, evaluate. Shared by shot and check. |
| `scripts/shot.mjs` | Modify: use the shared browser lib instead of its own copy. |
| `scripts/check.mjs` | Create: assertion harness. Exits non-zero on failure. This is the test runner. |
| `scripts/fetch-fonts.mjs` | Create: download the four woff2 subsets, emit the `@font-face` block. |
| `prototype/assets/fonts/*.woff2` | Create: four self-hosted font files. |
| `prototype/index.html` | Create fresh: the entire page. |
| `data/program.json` | Create: locally controlled performance dates. Replaces GoOut as source of truth. |
| `scripts/redraw-photos.mjs` | Create: OpenRouter photo redraw. Replaces `scripts/make-panels.sh`. |
| `scripts/publish-docs.sh` | Modify: publish the new page as the landing page. |
| `README.md` | Modify: describe the new direction. |

---

### Task 1: Shared browser harness and the check runner

There is no test framework in this repo and this plan does not add one. This task builds the thing that makes every later task testable: a headless-browser assertion runner. Without it there is no red/green cycle for any subsequent task.

**Files:**
- Create: `scripts/lib/browser.mjs`
- Create: `scripts/check.mjs`
- Modify: `scripts/shot.mjs:1-177`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `withPage(url, options, fn)` from `scripts/lib/browser.mjs`, where `options` is `{ width = 390, height = 844, mobile = true }` and `fn` receives `evaluate(expression)` returning the parsed JSON value. Resolves to `fn`'s return value and always kills the browser.
  - `node scripts/check.mjs [url]` — runs every assertion, prints one line per check, exits 1 if any failed.

- [ ] **Step 1: Write the failing test**

Create `scripts/check.mjs`. It starts with one assertion — that the page has a non-empty `<title>` — so there is something to run red before the page exists.

```js
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/check.mjs`
Expected: FAIL — `Cannot find module` for `./lib/browser.mjs`, because the harness does not exist yet.

- [ ] **Step 3: Write the shared browser library**

Create `scripts/lib/browser.mjs`. The CDP plumbing is lifted verbatim from `scripts/shot.mjs`, which already solved the hard parts: Chrome refuses to lay out below ~500px with `--window-size` and silently crops instead, so device metrics must be set over the protocol.

```js
// Drive a real headless Brave over the DevTools protocol.
//
// Extracted from shot.mjs so the screenshot tool and the assertion runner
// share one implementation. Node's global WebSocket means no dependencies.

import { spawn } from 'node:child_process';

const BRAVE = '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser';
const PORT = 9333;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function debuggerUrl() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const info = await response.json();
      if (info.webSocketDebuggerUrl) return info.webSocketDebuggerUrl;
    } catch {
      // not listening yet
    }
    await wait(150);
  }
  throw new Error('DevTools endpoint never came up');
}

class Client {
  constructor(socket) {
    this.socket = socket;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = [];

    socket.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      if (message.id && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(JSON.stringify(message.error)));
        else resolve(message.result);
        return;
      }
      for (const listener of this.listeners) listener(message);
    });
  }

  send(method, params = {}, sessionId) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    this.socket.send(JSON.stringify(payload));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }

  once(predicate) {
    return new Promise((resolve) => {
      const listener = (message) => {
        if (!predicate(message)) return;
        this.listeners = this.listeners.filter((entry) => entry !== listener);
        resolve(message);
      };
      this.listeners.push(listener);
    });
  }
}

export async function withPage(url, options, fn) {
  const { width = 390, height = 844, mobile = true, settle = 600 } = options ?? {};

  const browser = spawn(BRAVE, [
    '--headless',
    '--disable-gpu',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--user-data-dir=/tmp/parchant-shot-profile',
    'about:blank',
  ], { stdio: 'ignore' });

  try {
    const socket = new WebSocket(await debuggerUrl());
    await new Promise((resolve, reject) => {
      socket.addEventListener('open', resolve);
      socket.addEventListener('error', reject);
    });

    const client = new Client(socket);
    const { targetId } = await client.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await client.send('Target.attachToTarget', { targetId, flatten: true });

    await client.send('Emulation.setDeviceMetricsOverride', {
      width, height, deviceScaleFactor: 2, mobile,
    }, sessionId);

    await client.send('Page.enable', {}, sessionId);
    const loaded = client.once((message) => message.method === 'Page.loadEventFired');
    await client.send('Page.navigate', { url }, sessionId);
    await loaded;
    await wait(settle);

    const evaluate = async (expression) => {
      const { result, exceptionDetails } = await client.send('Runtime.evaluate', {
        expression: `(() => { return (${expression}); })()`,
        returnByValue: true,
        awaitPromise: true,
      }, sessionId);
      if (exceptionDetails) throw new Error(exceptionDetails.text ?? 'evaluate threw');
      return result.value;
    };

    const screenshot = async () => {
      const { data } = await client.send('Page.captureScreenshot', { format: 'png' }, sessionId);
      return Buffer.from(data, 'base64');
    };

    return await fn(evaluate, screenshot);
  } finally {
    browser.kill();
  }
}
```

- [ ] **Step 4: Create a minimal page so the check has a target**

Create `prototype/index.html` with just enough to pass. It is replaced wholesale in Task 3.

```html
<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Kolekce Parchant</title>
<style>
</style>
</head>
<body></body>
</html>
```

The empty `<style>` element is deliberate: Task 2 pastes the `@font-face` block into it, and every later task appends rules to it.

- [ ] **Step 5: Run the check to verify it passes**

Run: `node scripts/check.mjs`
Expected: `pass  page has a title` then `all checks passed`, exit 0.

- [ ] **Step 6: Rewire shot.mjs onto the shared library**

Replace the whole of `scripts/shot.mjs` with a version that imports `withPage`. The cell-overflow expression from the old file is dropped — it queried `.cell`, which only existed in the canvas direction. Overflow is now checked by `check.mjs` against the whole document.

```js
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
```

- [ ] **Step 7: Verify the screenshot tool still works**

Run: `node scripts/shot.mjs "$(node -e 'console.log(new URL("prototype/index.html", "file://" + process.cwd() + "/").href)')" /tmp/kp-check.png`
Expected: prints `/tmp/kp-check.png  390x844` and the file exists.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/browser.mjs scripts/check.mjs scripts/shot.mjs prototype/index.html
git commit -m "Add headless assertion runner and share CDP plumbing with shot"
```

---

### Task 2: Self-hosted fonts with verified Czech diacritics

The previous direction avoided webfonts deliberately. A poster direction cannot hold on a system stack, so this task brings in two faces — and proves they render Czech, which is the failure mode that kills most display fonts.

**Files:**
- Create: `scripts/fetch-fonts.mjs`
- Create: `prototype/assets/fonts/` (four `.woff2` files)
- Modify: `scripts/check.mjs`

**Interfaces:**
- Consumes: `withPage` from Task 1.
- Produces: font families `"Archivo Black"` and `"Archivo"` available to the page; `--display` and `--body` custom properties are defined in Task 3.

- [ ] **Step 1: Write the failing check**

Append to the `check(...)` list in `scripts/check.mjs`, above the `withPage` call:

```js
check(
  'Czech diacritics render in the display face',
  `(() => {
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
    const result = {};
    for (const family of ['"Archivo Black"', '"Archivo"']) {
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
```

- [ ] **Step 2: Run it to verify it fails**

Run: `node scripts/check.mjs`
Expected: `FAIL  Czech diacritics render in the display face — no Czech glyphs in "Archivo Black", "Archivo"` and exit 1. Nothing is loaded yet.

- [ ] **Step 3: Write the font fetcher**

Create `scripts/fetch-fonts.mjs`.

```js
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
```

- [ ] **Step 4: Run it**

Run: `node scripts/fetch-fonts.mjs`
Expected: four lines naming `archivo-black-latin.woff2`, `archivo-black-latin-ext.woff2`, `archivo-latin.woff2`, `archivo-latin-ext.woff2`, then the `@font-face` block. Each file should be roughly 10–40 kB. If any is under 1 kB the fetch returned an error page — stop and investigate rather than continuing.

- [ ] **Step 5: Paste the emitted block into the page**

Put the printed `@font-face` rules into a `<style>` element in `prototype/index.html`, directly after the opening `<style>` tag and before anything else.

- [ ] **Step 6: Run the check to verify it passes**

Run: `node scripts/check.mjs`
Expected: `pass  Czech diacritics render in the display face`, exit 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/fetch-fonts.mjs prototype/assets/fonts prototype/index.html scripts/check.mjs
git commit -m "Self-host Archivo and Archivo Black with verified Czech coverage"
```

---

### Task 3: Tokens, band scaffold and the contrast rule

This task replaces the stub page with the real skeleton: seven bands in the right grounds, and an automated guard on the contrast rule that the spec calls non-negotiable.

**Files:**
- Modify: `prototype/index.html`
- Modify: `scripts/check.mjs`

**Interfaces:**
- Consumes: the `@font-face` block from Task 2.
- Produces: `:root` properties `--cream --olive --lime --red --cherry --ink --display --body`; seven `<section class="band" id="...">` elements with `data-ground` set to one of `cream|olive|lime`; a `.band__inner` wrapper in each for width containment.

- [ ] **Step 1: Write the failing checks**

Append to `scripts/check.mjs`:

```js
check(
  'all seven bands exist in the right order with the right grounds',
  `JSON.stringify([...document.querySelectorAll('section.band')]
     .map((band) => band.id + ':' + band.dataset.ground))`,
  (raw) => {
    const expected = [
      'hero:olive', 'program:cream', 'repertoar:lime', 'soubor:cream',
      'o-nas:olive', 'o-prostoru:cream', 'fotky:lime',
    ];
    const actual = JSON.parse(raw);
    return JSON.stringify(actual) === JSON.stringify(expected)
      ? null
      : `got ${JSON.stringify(actual)}`;
  },
);

check(
  'text meets 4.5:1 against its band, and punch red is never body text',
  `(() => {
    const channel = (value) => {
      const c = value / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    };
    const luminance = (rgb) => {
      const [r, g, b] = rgb.match(/\\d+/g).map(Number);
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };
    const ratio = (a, b) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
      return (hi + 0.05) / (lo + 0.05);
    };
    const backdrop = (el) => {
      for (let node = el; node; node = node.parentElement) {
        const bg = getComputedStyle(node).backgroundColor;
        if (bg && !/rgba\\(0, 0, 0, 0\\)|transparent/.test(bg)) return bg;
      }
      return 'rgb(255, 255, 255)';
    };

    const problems = [];
    for (const el of document.querySelectorAll('p, li, a, dd, dt, figcaption, small, span, h1, h2, h3')) {
      if (!el.textContent.trim()) continue;
      if (el.querySelector('p, li, h1, h2, h3')) continue; // containers, not leaves
      const style = getComputedStyle(el);

      // Outlined display type is exempt from the ratio, because the ratio model
      // does not describe it: legibility comes from a hard ink edge on all
      // sides, not from the fill against the ground. Banning it outright would
      // ban the central poster technique. The exemption is paid for by
      // requiring the outline actually to be there.
      if (el.classList.contains('display--shadow')) {
        if (!/rgb\\(30, 27, 20\\)/.test(style.textShadow)) {
          problems.push(el.tagName + '.' + (el.className || '?') + ' is display--shadow with no ink outline');
        }
        continue;
      }

      const size = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      // WCAG large text: 24px, or 18.66px at 700+.
      const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
      const contrast = ratio(style.color, backdrop(el));
      const needed = isLarge ? 3 : 4.5;
      if (contrast < needed) {
        problems.push(el.tagName + '.' + (el.className || '?') + ' ' + contrast.toFixed(2) + ':1 needs ' + needed);
      }
      // The spec's own rule, stricter than WCAG: punch red is display-only.
      if (/235, 49, 63/.test(style.color) && !isLarge) {
        problems.push(el.tagName + '.' + (el.className || '?') + ' uses --red at ' + size + 'px');
      }
    }
    return JSON.stringify([...new Set(problems)].slice(0, 10));
  })()`,
  (raw) => {
    const problems = JSON.parse(raw);
    return problems.length ? problems.join('; ') : null;
  },
);

check(
  'nothing overflows horizontally at 390px',
  `(() => {
    // Content inside something that scrolls sideways on purpose - the photo
    // strip - is not overflow. Only content with nothing to scroll it counts.
    const inScroller = (el) => {
      for (let node = el.parentElement; node; node = node.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(node).overflowX)) return true;
      }
      return false;
    };

    const problems = [];
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (inScroller(el)) continue;
      if (box.right > innerWidth + 1) problems.push((el.className || el.tagName) + ' right+' + Math.round(box.right - innerWidth));
      if (box.left < -1) problems.push((el.className || el.tagName) + ' left' + Math.round(box.left));
    }
    return JSON.stringify([...new Set(problems)].slice(0, 10));
  })()`,
  (raw) => {
    const problems = JSON.parse(raw);
    return problems.length ? problems.join('; ') : null;
  },
);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/check.mjs`
Expected: `FAIL  all seven bands exist...  — got []`, exit 1.

- [ ] **Step 3: Write the skeleton**

Rewrite `prototype/index.html` below the `@font-face` block. Keep the fetched faces exactly as Task 2 emitted them.

```html
<!doctype html>
<html lang="cs">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<!-- Cast names are still unverified against the company's own list. -->
<meta name="robots" content="noindex, nofollow" />
<title>Kolekce Parchant</title>
<style>
/* --- @font-face block from scripts/fetch-fonts.mjs goes here --- */

/* ---------------------------------------------------------------------------
   Poster press. The page is a stack of printed posters, so each section is a
   colour band and scrolling reads as flipping through a pile.

   Palette comes from the two colour boards the client shared, which propose
   the same idea independently: yellow-green ground, a red, and cream.

   Two reds, for a measured reason. #EB313F on cream is about 4.2:1 - enough
   for large display type, short of the 4.5:1 body text needs. So punch red is
   display-only and cherry carries anything small. Cream never sits on olive
   (about 2:1); those bands take ink. scripts/check.mjs enforces both.

   Deliberately single-theme: a printed poster is paper, so there is no dark
   mode.
   --------------------------------------------------------------------------- */
:root {
  color-scheme: only light;

  --cream:  #FFFECD;
  --olive:  #B0BC68;
  --lime:   #CDD78A;
  --red:    #EB313F;
  --cherry: #AA0A27;
  --ink:    #1E1B14;

  --display: "Archivo Black", "Helvetica Neue", Impact, sans-serif;
  --body: "Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif;

  --measure: 34rem;
  --band-padding: clamp(3rem, 9vw, 6rem);
  --gutter: clamp(1.25rem, 5vw, 3rem);
}

* { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--cream);
  color: var(--ink);
  font-family: var(--body);
  font-size: clamp(1rem, 0.95rem + 0.3vw, 1.125rem);
  line-height: 1.55;
  overflow-x: hidden;
}

.band {
  padding: var(--band-padding) var(--gutter);
}

.band[data-ground="cream"] { background: var(--cream); }
.band[data-ground="olive"] { background: var(--olive); }
.band[data-ground="lime"]  { background: var(--lime); }

.band__inner {
  max-width: 68rem;
  margin-inline: auto;
}

/* Poster display type: the layered offset shadow does the mid-century work,
   so it holds on any heavy face rather than depending on one exact font. */
.display {
  font-family: var(--display);
  font-weight: 400;
  line-height: 0.9;
  letter-spacing: -0.01em;
  text-transform: uppercase;
  text-wrap: balance;
}

.display--shadow {
  color: var(--cream);
  text-shadow:
    2px 2px 0 var(--ink),
    4px 4px 0 var(--red),
    6px 6px 0 var(--ink);
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
</style>
</head>
<body>

<main>
  <section class="band" id="hero" data-ground="olive"><div class="band__inner"></div></section>
  <section class="band" id="program" data-ground="cream"><div class="band__inner"></div></section>
  <section class="band" id="repertoar" data-ground="lime"><div class="band__inner"></div></section>
  <section class="band" id="soubor" data-ground="cream"><div class="band__inner"></div></section>
  <section class="band" id="o-nas" data-ground="olive"><div class="band__inner"></div></section>
  <section class="band" id="o-prostoru" data-ground="cream"><div class="band__inner"></div></section>
  <section class="band" id="fotky" data-ground="lime"><div class="band__inner"></div></section>
</main>

</body>
</html>
```

- [ ] **Step 4: Run to verify it passes**

Run: `node scripts/check.mjs`
Expected: all four checks pass, exit 0.

- [ ] **Step 5: Commit**

```bash
git add prototype/index.html scripts/check.mjs
git commit -m "Add poster-press tokens, band scaffold and contrast enforcement"
```

---

### Task 4: Sticky header and burger overlay

The client asked for a burger menu over six named sections. This is the whole navigation model, replacing the canvas's mini-map, breadcrumb and edge arrows.

**Files:**
- Modify: `prototype/index.html`
- Modify: `scripts/check.mjs`

**Interfaces:**
- Consumes: the band ids from Task 3.
- Produces: `.masthead` (sticky), `.masthead__monogram`, `.burger[aria-expanded][aria-controls="nav"]`, `#nav.nav` containing exactly six `.nav__link` anchors.

- [ ] **Step 1: Write the failing checks**

Append to `scripts/check.mjs`:

```js
check(
  'burger nav lists the six sections and every target exists',
  `JSON.stringify([...document.querySelectorAll('#nav .nav__link')]
     .map((a) => a.getAttribute('href') + '|' + a.textContent.trim()
        + '|' + Boolean(document.querySelector(a.getAttribute('href')))))`,
  (raw) => {
    const expected = [
      '#program|Program|true',
      '#repertoar|Repertoár|true',
      '#soubor|Soubor|true',
      '#o-nas|O nás|true',
      '#o-prostoru|O prostoru|true',
      '#fotky|Fotky|true',
    ];
    const actual = JSON.parse(raw);
    return JSON.stringify(actual) === JSON.stringify(expected)
      ? null
      : `got ${JSON.stringify(actual)}`;
  },
);

check(
  'nav is closed at rest, opens on click, closes on Escape',
  `(() => {
    const burger = document.querySelector('.burger');
    const nav = document.querySelector('#nav');
    const closed = burger.getAttribute('aria-expanded') === 'false' && !nav.hasAttribute('data-open');
    burger.click();
    const opened = burger.getAttribute('aria-expanded') === 'true' && nav.hasAttribute('data-open');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const reclosed = burger.getAttribute('aria-expanded') === 'false' && !nav.hasAttribute('data-open');
    return JSON.stringify({ closed, opened, reclosed });
  })()`,
  (raw) => {
    const state = JSON.parse(raw);
    const bad = Object.entries(state).filter(([, ok]) => !ok).map(([name]) => name);
    return bad.length ? `failed: ${bad.join(', ')}` : null;
  },
);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/check.mjs`
Expected: both new checks FAIL — the first with `got []`, the second with a thrown error because `.burger` is null.

- [ ] **Step 3: Add the markup**

Insert immediately after `<body>`, before `<main>`:

```html
<header class="masthead">
  <a class="masthead__monogram" href="#hero" aria-label="Kolekce Parchant, na začátek">KP</a>
  <button class="burger" type="button" aria-expanded="false" aria-controls="nav">
    <span class="burger__label">Menu</span>
    <span class="burger__bars" aria-hidden="true"></span>
  </button>
</header>

<nav class="nav" id="nav" aria-label="Hlavní navigace">
  <ul class="nav__list">
    <li><a class="nav__link display" href="#program">Program</a></li>
    <li><a class="nav__link display" href="#repertoar">Repertoár</a></li>
    <li><a class="nav__link display" href="#soubor">Soubor</a></li>
    <li><a class="nav__link display" href="#o-nas">O nás</a></li>
    <li><a class="nav__link display" href="#o-prostoru">O prostoru</a></li>
    <li><a class="nav__link display" href="#fotky">Fotky</a></li>
  </ul>
</nav>
```

- [ ] **Step 4: Add the styles**

Append inside the `<style>` block:

```css
.masthead {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.75rem var(--gutter);
  background: var(--cream);
  border-bottom: 3px solid var(--ink);
}

.masthead__monogram {
  font-family: var(--display);
  font-size: 1.75rem;
  line-height: 1;
  color: var(--red);
  text-decoration: none;
  letter-spacing: -0.03em;
}

.burger {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.9rem;
  font: inherit;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--cream);
  background: var(--cherry);
  border: 3px solid var(--ink);
  cursor: pointer;
}

/* The bars are drawn rather than three elements: fewer nodes, and the open
   state only has to swap one gradient. */
.burger__bars {
  width: 1.25rem;
  height: 0.75rem;
  background:
    linear-gradient(var(--cream) 0 0) 0 0 / 100% 3px no-repeat,
    linear-gradient(var(--cream) 0 0) 0 50% / 100% 3px no-repeat,
    linear-gradient(var(--cream) 0 0) 0 100% / 100% 3px no-repeat;
}

.burger[aria-expanded="true"] .burger__bars {
  background:
    linear-gradient(var(--cream) 0 0) 0 50% / 100% 3px no-repeat,
    linear-gradient(var(--cream) 0 0) 0 50% / 100% 3px no-repeat;
}

.nav {
  position: fixed;
  inset: 0;
  z-index: 4;
  display: none;
  place-content: center;
  padding: var(--gutter);
  background: var(--cherry);
}

.nav[data-open] { display: grid; }

.nav__list {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  gap: clamp(0.5rem, 2vw, 1rem);
}

.nav__link {
  font-size: clamp(2rem, 11vw, 4.5rem);
  color: var(--cream);
  text-decoration: none;
}

.nav__link:hover,
.nav__link:focus-visible { color: var(--lime); }
```

- [ ] **Step 5: Add the behaviour**

Append a `<script>` before `</body>`:

```js
// Burger nav. The overlay is the entire navigation model, so it has to be
// keyboard-operable: Escape closes it and focus returns to the button.
const burger = document.querySelector('.burger');
const nav = document.querySelector('#nav');

function setNav(open) {
  burger.setAttribute('aria-expanded', String(open));
  nav.toggleAttribute('data-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  if (open) nav.querySelector('.nav__link').focus();
  else burger.focus();
}

burger.addEventListener('click', () => {
  setNav(burger.getAttribute('aria-expanded') === 'false');
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && burger.getAttribute('aria-expanded') === 'true') setNav(false);
});

// Following a link must close the overlay, or the target scrolls behind it.
nav.addEventListener('click', (event) => {
  if (event.target.closest('.nav__link')) setNav(false);
});
```

- [ ] **Step 6: Run to verify it passes**

Run: `node scripts/check.mjs`
Expected: all checks pass including the two new ones, exit 0.

- [ ] **Step 7: Commit**

```bash
git add prototype/index.html scripts/check.mjs
git commit -m "Add sticky masthead and burger overlay navigation"
```

---

### Task 5: Hero band

**Files:**
- Modify: `prototype/index.html`

**Interfaces:**
- Consumes: `.band`, `.display`, `.display--shadow` from Task 3.
- Produces: `.hero__claim[data-placeholder]` — the empty slot Zuzka's claim fills.

- [ ] **Step 1: Write the failing check**

Append to `scripts/check.mjs`:

```js
check(
  'hero carries the masthead, the pitch and an empty claim slot',
  `(() => {
    const hero = document.querySelector('#hero');
    return JSON.stringify({
      masthead: hero.querySelector('.hero__title')?.textContent.trim(),
      pitchStart: hero.querySelector('.hero__pitch')?.textContent.trim().slice(0, 24),
      claimIsPlaceholder: hero.querySelector('.hero__claim')?.hasAttribute('data-placeholder') ?? false,
      claimIsEmpty: (hero.querySelector('.hero__claim')?.textContent.trim().length ?? 1) === 0,
    });
  })()`,
  (raw) => {
    const hero = JSON.parse(raw);
    if (hero.masthead !== 'Kolekce Parchant') return `masthead was ${JSON.stringify(hero.masthead)}`;
    if (hero.pitchStart !== 'Divadelní soubor, který') return `pitch was ${JSON.stringify(hero.pitchStart)}`;
    if (!hero.claimIsPlaceholder) return 'claim slot is not marked data-placeholder';
    if (!hero.claimIsEmpty) return 'claim slot should stay empty until Zuzka sends it';
    return null;
  },
);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/check.mjs`
Expected: `FAIL  hero carries the masthead... — masthead was undefined`.

- [ ] **Step 3: Fill the hero band**

Replace the empty `#hero` band with:

```html
<section class="band band--hero" id="hero" data-ground="olive">
  <div class="band__inner">
    <p class="hero__eyebrow">Nezávislé divadlo &middot; Praha</p>

    <h1 class="hero__title display display--shadow">Kolekce Parchant</h1>

    <!-- The short claim under the logo is still pending from Zuzka. It is
         deliberately separate from the pitch below: the backlog lists them as
         two different items. Leave empty rather than inventing one. -->
    <p class="hero__claim" data-placeholder></p>

    <p class="hero__pitch">
      Divadelní soubor, který se nebojí provokovat. Jsme tu abychom bourali
      hranice a vytvářeli nezapomenutelné zážitky!
    </p>

    <p class="hero__venue">
      Studio Citadela &middot; Klimentská 16 &middot; Praha 1
    </p>
  </div>
</section>
```

- [ ] **Step 4: Style it**

Append inside `<style>`:

```css
.band--hero {
  min-height: 100svh;
  display: grid;
  align-content: center;
}

.hero__eyebrow {
  margin: 0 0 1.5rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.22em;
  font-size: 0.8rem;
}

.hero__title {
  margin: 0;
  font-size: clamp(3rem, 17vw, 9rem);
}

.hero__claim:empty { display: none; }

.hero__pitch {
  max-width: var(--measure);
  margin: 2.5rem 0 0;
  font-size: clamp(1.15rem, 1rem + 1vw, 1.6rem);
  font-weight: 600;
  text-wrap: pretty;
}

.hero__venue {
  margin: 2.5rem 0 0;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.85rem;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `node scripts/check.mjs`
Expected: all checks pass, exit 0. The contrast check from Task 3 is now doing real work — it covers ink on olive, which is roughly 8.5:1.

- [ ] **Step 6: Look at it**

Run: `node scripts/shot.mjs "file://$PWD/prototype/index.html" /tmp/kp-hero.png`
Expected: a full-height olive band, cream masthead with a red-and-ink layered shadow, no horizontal scrollbar.

- [ ] **Step 7: Commit**

```bash
git add prototype/index.html scripts/check.mjs
git commit -m "Add hero band with pitch and empty claim slot"
```

---

### Task 6: Program band and its empty state

There are zero upcoming dates and the client has not published autumn ones, so the empty state is the normal state at launch. It has to be designed as a real thing.

**Files:**
- Create: `data/program.json`
- Modify: `prototype/index.html`
- Modify: `scripts/check.mjs`

**Interfaces:**
- Consumes: `.band` from Task 3.
- Produces: `.ticket` cards; `.program__empty` shown when there are no future dates. `data/program.json` has shape `{ "updated": "YYYY-MM-DD", "dates": [{ "production": string, "slug": string, "start": "YYYY-MM-DDTHH:mm", "venue": string, "url": string, "state": "on_sale"|"sold_out"|"cancelled" }] }`.

- [ ] **Step 1: Write the failing check**

Append to `scripts/check.mjs`:

```js
check(
  'program shows its empty state when there are no future dates',
  `(() => {
    const band = document.querySelector('#program');
    const empty = band.querySelector('.program__empty');
    return JSON.stringify({
      hasHeading: Boolean(band.querySelector('.band__heading')),
      emptyVisible: Boolean(empty) && getComputedStyle(empty).display !== 'none',
      emptyMentionsGoOut: (empty?.textContent ?? '').includes('GoOut'),
      ticketCount: band.querySelectorAll('.ticket').length,
    });
  })()`,
  (raw) => {
    const program = JSON.parse(raw);
    if (!program.hasHeading) return 'no section heading';
    if (!program.emptyVisible) return 'empty state is not visible';
    if (!program.emptyMentionsGoOut) return 'empty state should say where dates get announced';
    if (program.ticketCount !== 0) return `expected no tickets, got ${program.ticketCount}`;
    return null;
  },
);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/check.mjs`
Expected: `FAIL  program shows its empty state — no section heading`.

- [ ] **Step 3: Create the local dates file**

Create `data/program.json`. GoOut is no longer the source of truth — the client's feedback says it is not under their management and they will arrange their own — so this file is ours and starts empty.

```json
{
  "updated": "2026-08-16",
  "note": "Locally controlled. GoOut is no longer the source of truth; scripts/fetch-goout.mjs is an optional refresh and nothing on the page depends on it.",
  "dates": []
}
```

- [ ] **Step 4: Fill the program band**

Content is static markup, so the ticket cards are written into the HTML rather than rendered from the JSON at runtime. `data/program.json` is the authoring source a later build step or a human copies from. Replace the empty `#program` band with:

```html
<section class="band" id="program" data-ground="cream">
  <div class="band__inner">
    <h2 class="band__heading display">
      <span class="ribbon">Program</span>
    </h2>

    <!-- No upcoming dates as of 2026-08-16; the last performance was
         2026-05-23. This is the normal state at launch, not a fallback.
         Add .ticket cards here from data/program.json as dates are published. -->
    <div class="program__empty">
      <p class="program__empty-title display">Zatím žádný vypsaný termín</p>
      <p>
        Nové termíny vypisujeme na GoOut. Jakmile se objeví tam, najdete je i tady.
      </p>
      <p>
        <a class="link" href="https://goout.net/cs/kolekce-parchant/pzpmtpg/">
          Sledovat na GoOut
        </a>
      </p>
    </div>
  </div>
</section>
```

- [ ] **Step 5: Style the heading, ribbon, ticket and empty state**

Append inside `<style>`. The ticket rule is written now even though no ticket exists yet, so publishing a date is a markup paste with no CSS work.

```css
.band__heading {
  margin: 0 0 2.5rem;
  font-size: clamp(2rem, 8vw, 3.5rem);
}

/* Notched ribbon: the circus vocabulary is structural, so a section head is a
   banner rather than an illustration of one. */
.ribbon {
  display: inline-block;
  padding: 0.4em 1.4em;
  color: var(--cream);
  background: var(--cherry);
  clip-path: polygon(
    0 0, 100% 0, calc(100% - 0.8em) 50%, 100% 100%,
    0 100%, 0.8em 50%
  );
}

.link {
  color: var(--cherry);
  font-weight: 700;
  text-underline-offset: 0.2em;
}

.program__empty {
  max-width: var(--measure);
  padding: 2rem;
  border: 3px dashed var(--ink);
}

.program__empty-title {
  margin: 0 0 1rem;
  font-size: clamp(1.35rem, 5vw, 2rem);
  color: var(--cherry);
}

/* Perforated ticket stub. The mask is a row of half-circles bitten out of the
   left edge, which is what makes a rectangle read as a torn ticket. */
.ticket {
  --notch: 0.6rem;
  position: relative;
  display: grid;
  gap: 0.35rem;
  padding: 1.5rem 1.5rem 1.5rem 2.5rem;
  background: var(--cream);
  border: 3px solid var(--ink);
  mask-image: radial-gradient(var(--notch) at left, #0000 98%, #000);
  mask-size: 100% calc(var(--notch) * 3);
  mask-repeat: repeat-y;
}

.ticket__date {
  font-family: var(--display);
  font-size: 1.5rem;
  color: var(--cherry);
}

.ticket[data-state="sold_out"] { opacity: 0.55; }
```

- [ ] **Step 6: Run to verify it passes**

Run: `node scripts/check.mjs`
Expected: all checks pass, exit 0.

- [ ] **Step 7: Commit**

```bash
git add prototype/index.html data/program.json scripts/check.mjs
git commit -m "Add program band with a designed empty state and local dates source"
```

---

### Task 7: Repertoár band with press quotes

Two productions. *Audience / Pivařská odysea* is omitted at the client's explicit request. Do not add it back.

**Files:**
- Modify: `prototype/index.html`
- Modify: `scripts/check.mjs`

**Interfaces:**
- Consumes: `.band__heading`, `.ribbon`, `.link` from Task 6.
- Produces: `article.production[data-slug]`; `.press` quote block; `.press__score` badge.

- [ ] **Step 1: Write the failing check**

Append to `scripts/check.mjs`:

```js
check(
  'repertoire holds exactly the two approved productions with correct press treatment',
  `(() => {
    const productions = [...document.querySelectorAll('#repertoar .production')];
    return JSON.stringify({
      slugs: productions.map((p) => p.dataset.slug),
      sipyQuotes: document.querySelectorAll('[data-slug="rychle-sipy-a-zahada-klubovny"] .press blockquote').length,
      hraQuotes: document.querySelectorAll('[data-slug="hra-lasky-a-nahody"] .press blockquote').length,
      hraScore: document.querySelector('[data-slug="hra-lasky-a-nahody"] .press__score')?.textContent.trim(),
      mentionsAudience: document.body.textContent.includes('Pivařská'),
      castCorrect: document.querySelector('[data-slug="hra-lasky-a-nahody"]').textContent.includes('Aliska'),
      staleCast: document.body.textContent.includes('Aneta Kalertová')
        || document.body.textContent.includes('Mikuláš Polák')
        || document.body.textContent.includes('Višata'),
    });
  })()`,
  (raw) => {
    const r = JSON.parse(raw);
    const expected = ['rychle-sipy-a-zahada-klubovny', 'hra-lasky-a-nahody'];
    if (JSON.stringify(r.slugs) !== JSON.stringify(expected)) return `slugs were ${JSON.stringify(r.slugs)}`;
    if (r.sipyQuotes !== 2) return `Rychlé šípy should show 2 pull quotes, got ${r.sipyQuotes}`;
    if (r.hraQuotes !== 0) return 'Hra lásky has no review text, so it must show no quote';
    if (r.hraScore !== '90 %') return `Hra lásky score badge was ${JSON.stringify(r.hraScore)}`;
    if (r.mentionsAudience) return 'Audience / Pivařská odysea must not appear';
    if (!r.castCorrect) return 'Aliska is missing from the Hra lásky cast';
    if (r.staleCast) return 'a corrected-away name is still on the page';
    return null;
  },
);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/check.mjs`
Expected: `FAIL  repertoire holds exactly the two approved productions — slugs were []`.

- [ ] **Step 3: Fill the repertoire band**

All Czech text below is verbatim from i-divadlo or from the client. Do not paraphrase it and do not translate it.

```html
<section class="band" id="repertoar" data-ground="lime">
  <div class="band__inner">
    <h2 class="band__heading display"><span class="ribbon">Repertoár</span></h2>

    <article class="production" data-slug="rychle-sipy-a-zahada-klubovny">
      <h3 class="production__title display">
        <span class="production__title-lead">Rychlé šípy</span>
        <span class="production__title-rest">a záhada klubovny</span>
      </h3>

      <p class="production__blurb">
        Záhada slavných Foglarových Rychlých šípů v nové size od designera
        Šimona Lorka.
      </p>
      <!-- The client wrote "v nové size". Almost certainly meant "v nové
           verzi", but these are her words: ask before changing them. -->

      <p class="production__annotation">
        Napínavá a hravá autorská inscenace plná humoru a dobrodružství, která
        přináší svěží pohled na legendární příběh a zároveň dokazuje, že hodnoty
        Rychlých šípů jsou nadčasové. Mirek Dušín, Jarka Metelka, Jindra Hojer,
        Červenáček a Rychlonožka se vracejí do své klubovny, ale čeká je šok
        &ndash; jejich útočiště je obsazené někým cizím. Kdo vetřelcem je? Jak se
        do klubovny dostal?
      </p>

      <dl class="credits">
        <dt>Napsal</dt><dd>Šimon Lorko, na motivy knih Jaroslava Foglara</dd>
        <dt>Režie a scéna</dt><dd>Prokop Zach</dd>
        <dt>Hudba</dt><dd>Marek Cimbál</dd>
        <!-- Cast per i-divadlo, not yet confirmed against the company's own
             list. Note Maxmilián Kocek and Matouš Vyšata: the earlier
             prototype misspelled both, having read them off a poster photo. -->
        <dt>Hrají</dt><dd>Prokop Zach, Maxmilián Kocek / Matouš Vyšata, Ondřej Stupka, Zuzana Matušková, Maximilián Dolanský</dd>
        <dt>Archivní nahrávky</dt><dd>Tomáš Turek, Roman Zach</dd>
        <dt>Premiéra</dt><dd>30. 1. 2026</dd>
        <dt>Délka</dt><dd>1 h 15 min, bez přestávky</dd>
        <dt>Přístupnost</dt><dd>6+</dd>
      </dl>

      <div class="press">
        <p class="press__score">87 %</p>
        <blockquote>
          <p>
            Uvolněné představení, které mnohé přenese zpět do mladých let, nebo
            alespoň budou pociťovat silnou nostalgii. Děj byl volný, dialogy
            vtipné, kde se to hodilo. Vyvrcholení hry bylo velkým překvapením.
          </p>
          <footer>Hessy &middot; 90 % &middot; 20. 3. 2026</footer>
        </blockquote>
        <blockquote>
          <p>
            Úžasný! &hellip; Určitě doporučuji všem věkovým kategoriím.
          </p>
          <footer>Mariematenova &middot; 100 % &middot; 20. 2. 2026</footer>
        </blockquote>
        <p class="press__source">
          Hodnocení diváků na
          <a class="link" href="https://www.i-divadlo.cz/divadlo/kolekce-parchant/rychle-sipy-a-zahada-klubovny">i-divadlo.cz</a>
        </p>
      </div>
    </article>

    <article class="production" data-slug="hra-lasky-a-nahody">
      <h3 class="production__title display">
        <span class="production__title-lead">Hra lásky</span>
        <span class="production__title-rest">a náhody</span>
      </h3>

      <p class="production__blurb">
        Klasická francouzská komedie z roku 1730 od Marivauxe v novém českém
        designu od Kolekce Parchant.
      </p>

      <p class="production__annotation">
        Slavná komedie francouzského klasika. Ona předstírá, že je služka. On
        dělá, že je sluha. Oba chtějí &bdquo;nenápadně&ldquo; zjistit, koho si
        mají vzít. Výsledek? Láska na první pohled mezi dvěma lidmi, kteří si
        myslí, že milují úplně někoho jiného. Zkrátka romantika, chaos a
        převleky. Ať žije láska! A záměny!
      </p>

      <dl class="credits">
        <dt>Autor</dt><dd>Pierre de Marivaux</dd>
        <dt>Režie</dt><dd>Prokop Zach</dd>
        <dt>Hudba</dt><dd>Marek Cimbál</dd>
        <!-- The client asked for Aliska in place of Aneta Kalertová.
             i-divadlo still lists the old name; ours to apply, theirs to fix. -->
        <dt>Hrají</dt><dd>Aliska, Jiří Dlouhý / Šimon Fikar, Ondřej Stupka, Zuzana Matušková, Maximilián Dolanský, Prokop Zach</dd>
        <dt>Premiéra</dt><dd>2. 5. 2025</dd>
      </dl>

      <div class="press">
        <!-- One 90% rating with no review text, so a badge and nothing more.
             Inventing a quote here would be fabricating a review. -->
        <p class="press__score">90 %</p>
        <p class="press__source">
          Hodnocení diváků na
          <a class="link" href="https://www.i-divadlo.cz/divadlo/kolekce-parchant/hra-lasky-a-nahody">i-divadlo.cz</a>
        </p>
      </div>
    </article>
  </div>
</section>
```

- [ ] **Step 4: Style it**

Append inside `<style>`:

```css
.production {
  padding-block: clamp(2rem, 6vw, 3.5rem);
  border-top: 3px solid var(--ink);
}

.production:first-of-type { border-top: 0; padding-top: 0; }

/* Stacked mixed-size title, the poster move: the memorable half is set large
   and the qualifier runs small underneath. */
.production__title {
  margin: 0 0 1.5rem;
  display: grid;
}

.production__title-lead { font-size: clamp(2.25rem, 11vw, 5rem); }

.production__title-rest {
  font-size: clamp(1rem, 4.2vw, 2rem);
  color: var(--cherry);
}

.production__blurb {
  max-width: var(--measure);
  font-size: clamp(1.05rem, 1rem + 0.5vw, 1.3rem);
  font-weight: 600;
}

.production__annotation {
  max-width: var(--measure);
  text-wrap: pretty;
}

.credits {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.35rem 1.25rem;
  margin: 2rem 0 0;
  font-size: 0.9rem;
}

.credits dt {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 0.72rem;
  padding-top: 0.22em;
}

.credits dd { margin: 0; }

.press {
  margin-top: 2.5rem;
  padding: 1.5rem;
  background: var(--cream);
  border: 3px solid var(--ink);
}

.press__score {
  margin: 0 0 1rem;
  font-family: var(--display);
  font-size: clamp(2rem, 8vw, 3rem);
  line-height: 1;
  color: var(--cherry);
}

.press blockquote {
  margin: 0 0 1.25rem;
  padding-left: 1rem;
  border-left: 3px solid var(--red);
}

.press blockquote p {
  margin: 0 0 0.5rem;
  font-size: 1.05rem;
  font-style: italic;
  text-wrap: pretty;
}

.press blockquote footer {
  font-size: 0.78rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.press__source { margin: 0; font-size: 0.82rem; }
```

- [ ] **Step 5: Run to verify it passes**

Run: `node scripts/check.mjs`
Expected: all checks pass, exit 0.

- [ ] **Step 6: Commit**

```bash
git add prototype/index.html scripts/check.mjs
git commit -m "Add repertoire band with the two approved productions and press quotes"
```

---

### Task 8: Soubor, O nás and O prostoru bands

**Files:**
- Modify: `prototype/index.html`
- Modify: `scripts/check.mjs`

**Interfaces:**
- Consumes: `.band__heading`, `.ribbon`, `.link`.
- Produces: `.ensemble__person` cards; `.prose` for the O nás text.

- [ ] **Step 1: Write the failing check**

Append to `scripts/check.mjs`:

```js
check(
  'ensemble, about and venue bands carry their content',
  `JSON.stringify({
    people: document.querySelectorAll('#soubor .ensemble__person').length,
    aboutIsPlaceholder: Boolean(document.querySelector('#o-nas [data-placeholder]')),
    venueHasAddress: document.querySelector('#o-prostoru').textContent.includes('Klimentská 16'),
    venueHasTrams: document.querySelector('#o-prostoru').textContent.includes('Dlouhá třída'),
  })`,
  (raw) => {
    const s = JSON.parse(raw);
    if (s.people !== 11) return `expected 11 ensemble members, got ${s.people}`;
    if (!s.aboutIsPlaceholder) return 'O nás prose is still pending and must be marked data-placeholder';
    if (!s.venueHasAddress) return 'venue band is missing the address';
    if (!s.venueHasTrams) return 'venue band is missing the tram stop';
    return null;
  },
);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/check.mjs`
Expected: `FAIL  ensemble, about and venue bands carry their content — expected 11 ensemble members, got 0`.

- [ ] **Step 3: Fill the three bands**

```html
<section class="band" id="soubor" data-ground="cream">
  <div class="band__inner">
    <h2 class="band__heading display"><span class="ribbon">Soubor</span></h2>

    <!-- Compiled from the two productions' credits on i-divadlo. This is a
         better source than the previous list, which was read off a photograph
         of a poster, but it is still not the company's own list. Three
         corrections against the old prototype: Maxmilián not Maximilián Kocek,
         Vyšata not Višata, and Mikuláš Polák removed - he appears nowhere on
         i-divadlo. Confirm all of this with the company before launch. -->
    <ul class="ensemble">
      <li class="ensemble__person"><span class="ensemble__name">Prokop Zach</span><span class="ensemble__role">režie, scéna, hraje</span></li>
      <li class="ensemble__person"><span class="ensemble__name">Zuzana Matušková</span><span class="ensemble__role">hraje</span></li>
      <li class="ensemble__person"><span class="ensemble__name">Ondřej Stupka</span><span class="ensemble__role">hraje</span></li>
      <li class="ensemble__person"><span class="ensemble__name">Maximilián Dolanský</span><span class="ensemble__role">hraje</span></li>
      <li class="ensemble__person"><span class="ensemble__name">Maxmilián Kocek</span><span class="ensemble__role">hraje</span></li>
      <li class="ensemble__person"><span class="ensemble__name">Matouš Vyšata</span><span class="ensemble__role">alternace</span></li>
      <li class="ensemble__person"><span class="ensemble__name">Aliska</span><span class="ensemble__role">hraje</span></li>
      <li class="ensemble__person"><span class="ensemble__name">Jiří Dlouhý</span><span class="ensemble__role">hraje</span></li>
      <li class="ensemble__person"><span class="ensemble__name">Šimon Fikar</span><span class="ensemble__role">alternace</span></li>
      <li class="ensemble__person"><span class="ensemble__name">Šimon Lorko</span><span class="ensemble__role">text</span></li>
      <li class="ensemble__person"><span class="ensemble__name">Marek Cimbál</span><span class="ensemble__role">hudba</span></li>
    </ul>

    <p class="ensemble__note">
      Archivní nahrávky &middot; Tomáš Turek, Roman Zach
    </p>
  </div>
</section>

<section class="band" id="o-nas" data-ground="olive">
  <div class="band__inner">
    <h2 class="band__heading display"><span class="ribbon">O nás</span></h2>

    <!-- Her own text is still pending. This holds the space so the layout can
         be judged; replace it wholesale, do not edit around it. -->
    <div class="prose" data-placeholder>
      <p>
        Sem patří text o souboru &mdash; kdo jste, jak jste začali, proč
        Parchant. Zatím drží místo, aby bylo vidět, kolik ho na stránce je.
      </p>
    </div>
  </div>
</section>

<section class="band" id="o-prostoru" data-ground="cream">
  <div class="band__inner">
    <h2 class="band__heading display"><span class="ribbon">O prostoru</span></h2>

    <div class="prose">
      <p>
        Hrajeme ve Studiu Citadela v suterénu na Klimentské. Publikum sedí metr
        od nás &mdash; a to je celý ten trik.
      </p>
    </div>

    <dl class="credits">
      <dt>Adresa</dt><dd>Studio Citadela, Klimentská 16, Praha 1</dd>
      <dt>Tramvaj</dt><dd>6, 8, 15, 26 &mdash; zastávka Dlouhá třída</dd>
    </dl>
  </div>
</section>
```

- [ ] **Step 4: Style it**

Append inside `<style>`:

```css
.ensemble {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
  gap: 0.75rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ensemble__person {
  display: grid;
  gap: 0.15rem;
  padding: 1rem;
  background: var(--lime);
  border: 3px solid var(--ink);
}

.ensemble__name {
  font-family: var(--display);
  font-size: 1.05rem;
  line-height: 1.15;
}

.ensemble__role {
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.ensemble__note {
  margin: 1.5rem 0 0;
  font-size: 0.82rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.prose {
  max-width: var(--measure);
  font-size: clamp(1.05rem, 1rem + 0.5vw, 1.25rem);
}

.prose p { margin: 0 0 1em; text-wrap: pretty; }
```

- [ ] **Step 5: Run to verify it passes**

Run: `node scripts/check.mjs`
Expected: all checks pass, exit 0.

- [ ] **Step 6: Commit**

```bash
git add prototype/index.html scripts/check.mjs
git commit -m "Add ensemble, about and venue bands"
```

---

### Task 9: Fotky band, footer and social metadata

This task closes the page and fixes the thing the backlog calls the most useful item of all: shared links currently preview blank, and the audience arrives from Instagram, where scrapers never run JavaScript.

**Files:**
- Modify: `prototype/index.html`
- Modify: `scripts/check.mjs`

**Interfaces:**
- Consumes: everything above.
- Produces: `.gallery` strip; `.footer`; Open Graph and `schema.org/TheaterGroup` metadata in `<head>`.

- [ ] **Step 1: Write the failing check**

Append to `scripts/check.mjs`:

```js
check(
  'social metadata is present and content is visible without JavaScript',
  `JSON.stringify({
    ogTitle: document.querySelector('meta[property="og:title"]')?.content ?? null,
    ogDescription: (document.querySelector('meta[property="og:description"]')?.content ?? '').length,
    ogImage: Boolean(document.querySelector('meta[property="og:image"]')),
    description: (document.querySelector('meta[name="description"]')?.content ?? '').length,
    schemaType: JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')['@type'] ?? null,
    instagram: Boolean(document.querySelector('.footer a[href*="instagram.com/kolekce_parchant"]')),
  })`,
  (raw) => {
    const meta = JSON.parse(raw);
    if (meta.ogTitle !== 'Kolekce Parchant') return `og:title was ${JSON.stringify(meta.ogTitle)}`;
    if (meta.ogDescription < 40) return 'og:description is missing or too short';
    if (!meta.ogImage) return 'og:image is missing, so shares preview blank';
    if (meta.description < 40) return 'meta description is missing or too short';
    if (meta.schemaType !== 'TheaterGroup') return `schema @type was ${JSON.stringify(meta.schemaType)}`;
    if (!meta.instagram) return 'footer is missing the Instagram link';
    return null;
  },
);

check(
  'every band has real markup rather than script-built content',
  `(() => {
    // Social scrapers never run JS. If a band is empty in the served markup it
    // is invisible to them, however it looks in a browser.
    const thin = [...document.querySelectorAll('section.band')]
      .filter((band) => band.textContent.trim().length < 40)
      .map((band) => band.id);
    return JSON.stringify(thin);
  })()`,
  (raw) => {
    const thin = JSON.parse(raw);
    return thin.length ? `these bands have almost no text: ${thin.join(', ')}` : null;
  },
);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/check.mjs`
Expected: `FAIL  social metadata is present — og:title was null`.

- [ ] **Step 3: Add the head metadata**

Insert into `<head>`, after `<title>`:

```html
<meta name="description" content="Kolekce Parchant je nezávislý divadelní soubor ze Studia Citadela v Praze. Rychlé šípy a záhada klubovny, Hra lásky a náhody." />

<meta property="og:type" content="website" />
<meta property="og:locale" content="cs_CZ" />
<meta property="og:site_name" content="Kolekce Parchant" />
<meta property="og:title" content="Kolekce Parchant" />
<meta property="og:description" content="Divadelní soubor, který se nebojí provokovat. Studio Citadela, Klimentská 16, Praha 1." />
<meta property="og:image" content="assets/panels/hero.png" />
<meta name="twitter:card" content="summary_large_image" />

<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "TheaterGroup",
  "name": "Kolekce Parchant",
  "url": "https://kolekceparchant.cz",
  "location": {
    "@type": "PerformingArtsTheater",
    "name": "Studio Citadela",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Klimentská 16",
      "addressLocality": "Praha 1",
      "addressCountry": "CZ"
    }
  },
  "sameAs": [
    "https://www.instagram.com/kolekce_parchant",
    "https://www.i-divadlo.cz/divadlo/kolekce-parchant"
  ]
}
</script>
```

Note: `og:image` is a relative path here because the page is still served from a path-based host. Change it to an absolute `https://kolekceparchant.cz/...` URL at launch — most scrapers will not resolve a relative one.

- [ ] **Step 4: Fill the gallery band and add the footer**

Replace the empty `#fotky` band, and add the footer after `</main>`:

```html
<section class="band" id="fotky" data-ground="lime">
  <div class="band__inner">
    <h2 class="band__heading display"><span class="ribbon">Fotky</span></h2>

    <!-- Only the Rychlé šípy photographs are identifiable. Nothing else may be
         captioned with a production name; misattributing someone else's
         production is worse than an uncaptioned photo. -->
    <div class="gallery">
      <figure class="gallery__item">
        <img src="assets/panels/sipy-1.png" alt="Scéna z inscenace Rychlé šípy a záhada klubovny" loading="lazy" width="1200" height="800" />
        <figcaption>Rychlé šípy a záhada klubovny</figcaption>
      </figure>
      <figure class="gallery__item">
        <img src="assets/panels/sipy-2.png" alt="Scéna z inscenace Rychlé šípy a záhada klubovny" loading="lazy" width="1200" height="800" />
        <figcaption>Rychlé šípy a záhada klubovny</figcaption>
      </figure>
      <figure class="gallery__item">
        <img src="assets/panels/sipy-3.png" alt="Scéna z inscenace Rychlé šípy a záhada klubovny" loading="lazy" width="1200" height="800" />
        <figcaption>Rychlé šípy a záhada klubovny</figcaption>
      </figure>
      <figure class="gallery__item">
        <img src="assets/panels/ensemble.png" alt="Herci Kolekce Parchant na jevišti" loading="lazy" width="1200" height="800" />
        <figcaption>Soubor</figcaption>
      </figure>
    </div>
  </div>
</section>
```

```html
<footer class="footer">
  <div class="band__inner">
    <p class="footer__mark display">KP</p>
    <ul class="footer__links">
      <li><a href="https://www.instagram.com/kolekce_parchant">Instagram</a></li>
      <li><a href="https://www.i-divadlo.cz/divadlo/kolekce-parchant">i-divadlo.cz</a></li>
      <li><a href="https://goout.net/cs/kolekce-parchant/pzpmtpg/">Vstupenky na GoOut</a></li>
    </ul>
    <p class="footer__address">Studio Citadela &middot; Klimentská 16 &middot; Praha 1</p>
  </div>
</footer>
```

- [ ] **Step 5: Style it**

Append inside `<style>`:

```css
.gallery {
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: min(78vw, 26rem);
  gap: 1rem;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  padding-bottom: 1rem;
  /* The strip scrolls inside itself; the page never scrolls sideways. */
  margin-inline: calc(var(--gutter) * -1);
  padding-inline: var(--gutter);
}

.gallery__item {
  margin: 0;
  scroll-snap-align: start;
}

.gallery__item img {
  display: block;
  width: 100%;
  height: auto;
  border: 3px solid var(--ink);
}

.gallery__item figcaption {
  margin-top: 0.5rem;
  font-size: 0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.footer {
  padding: var(--band-padding) var(--gutter);
  background: var(--ink);
  color: var(--cream);
}

.footer__mark {
  margin: 0 0 1.5rem;
  font-size: 3rem;
  color: var(--red);
}

.footer__links {
  margin: 0 0 1.5rem;
  padding: 0;
  list-style: none;
  display: grid;
  gap: 0.5rem;
}

.footer__links a {
  color: var(--cream);
  font-weight: 700;
  text-underline-offset: 0.2em;
}

.footer__address {
  margin: 0;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
```

- [ ] **Step 6: Run to verify it passes**

Run: `node scripts/check.mjs`
Expected: all checks pass, exit 0.

- [ ] **Step 7: Check the other two breakpoints**

Run:
```bash
node scripts/check.mjs && \
node scripts/shot.mjs "file://$PWD/prototype/index.html" /tmp/kp-390.png 390 844 && \
node scripts/shot.mjs "file://$PWD/prototype/index.html" /tmp/kp-768.png 768 1024 && \
node scripts/shot.mjs "file://$PWD/prototype/index.html" /tmp/kp-1440.png 1440 900
```
Expected: checks pass and three PNGs exist. Open them and confirm the bands alternate cream / olive / lime with no two adjacent the same.

- [ ] **Step 8: Commit**

```bash
git add prototype/index.html scripts/check.mjs
git commit -m "Add gallery band, footer and social metadata"
```

---

### Task 10: Poster ornament — arrow signs, dividers and the animation hook

Three spec items that no earlier task delivered: the arrow sign, the star dividers, and the hook the actor-motion animation will attach to. The arrow matters beyond decoration — it is the one device carried over from the comic direction, where the five *rychlé šípy* were the wayfinding motif.

**Files:**
- Modify: `prototype/index.html`
- Modify: `scripts/check.mjs`

**Interfaces:**
- Consumes: `.nav__link` from Task 4, `.band` from Task 3.
- Produces: `.arrow` (inline SVG, `aria-hidden`); `.divider` between bands; `[data-animate="hero"]` on the first gallery figure.

- [ ] **Step 1: Write the failing check**

Append to `scripts/check.mjs`:

```js
check(
  'arrow signs, dividers and the animation hook are in place',
  `JSON.stringify({
    navArrows: document.querySelectorAll('#nav .nav__link .arrow').length,
    arrowsHidden: [...document.querySelectorAll('.arrow')].every((a) => a.getAttribute('aria-hidden') === 'true'),
    dividers: document.querySelectorAll('.divider').length,
    animateHook: document.querySelectorAll('[data-animate]').length,
  })`,
  (raw) => {
    const o = JSON.parse(raw);
    if (o.navArrows !== 6) return `expected an arrow on each of the 6 nav links, got ${o.navArrows}`;
    if (!o.arrowsHidden) return 'arrows are decorative and must be aria-hidden';
    if (o.dividers !== 6) return `expected 6 dividers between 7 bands, got ${o.dividers}`;
    if (o.animateHook !== 1) return `expected exactly one data-animate hook, got ${o.animateHook}`;
    return null;
  },
);
```

- [ ] **Step 2: Run to verify it fails**

Run: `node scripts/check.mjs`
Expected: `FAIL  arrow signs, dividers and the animation hook are in place — expected an arrow on each of the 6 nav links, got 0`.

- [ ] **Step 3: Add the arrow to each nav link**

Insert this span inside every one of the six `.nav__link` anchors, immediately before the closing `</a>`. The arrow is drawn rather than a glyph so it keeps the flat poster edge at any size.

```html
<span class="arrow" aria-hidden="true">
  <svg viewBox="0 0 40 24" focusable="false"><path d="M0 8h24V0l16 12-16 12v-8H0z" /></svg>
</span>
```

So a link reads:

```html
<li><a class="nav__link display" href="#program">Program<span class="arrow" aria-hidden="true"><svg viewBox="0 0 40 24" focusable="false"><path d="M0 8h24V0l16 12-16 12v-8H0z" /></svg></span></a></li>
```

- [ ] **Step 4: Add dividers between the bands**

Insert `<div class="divider" aria-hidden="true"></div>` between each adjacent pair of `<section class="band">` elements inside `<main>` — six of them, none before `#hero` and none after `#fotky`.

- [ ] **Step 5: Add the animation hook**

Add `data-animate="hero"` to the first `<figure class="gallery__item">` in the Fotky band:

```html
<figure class="gallery__item" data-animate="hero">
```

The actor-motion animation is being explored separately and needs a provider that is not OpenRouter, which has no video models. This attribute is where it lands; nothing reads it yet.

- [ ] **Step 6: Style the ornament**

Append inside `<style>`:

```css
.nav__link {
  display: flex;
  align-items: center;
  gap: 0.5em;
}

.arrow {
  display: inline-block;
  width: 0.9em;
  flex: none;
}

.arrow svg {
  display: block;
  width: 100%;
  height: auto;
  fill: currentColor;
}

/* A row of ink diamonds on the boundary between two bands, so the seam reads
   as a printer's rule rather than a colour change. */
.divider {
  height: 1.25rem;
  background:
    conic-gradient(from 45deg at 50% 50%, var(--ink) 0 90deg, #0000 0 100%)
    0 0 / 1.25rem 1.25rem repeat-x;
  background-color: var(--cream);
}
```

- [ ] **Step 7: Run to verify it passes**

Run: `node scripts/check.mjs`
Expected: all checks pass, exit 0. The horizontal-overflow check from Task 3 covers the dividers, which are the most likely thing to push the page sideways.

- [ ] **Step 8: Commit**

```bash
git add prototype/index.html scripts/check.mjs
git commit -m "Add arrow signs, band dividers and the animation hook"
```

---

### Task 11: Photo redraw pipeline

Replaces `scripts/make-panels.sh`. The posterize treatment existed to make phone shots read as deliberate print; it belonged to the comic direction. A probe established that an image model redraws these stage photos as inked panels for about four cents each, at a quality above the filter, because it reinterprets rather than filters.

**Files:**
- Create: `scripts/redraw-photos.mjs`
- Modify: `README.md`

**Interfaces:**
- Consumes: `OPENROUTER_API_TOKEN` from the environment.
- Produces: `node scripts/redraw-photos.mjs <source-dir> [out-dir]` writing PNGs into `prototype/assets/panels/`.

- [ ] **Step 1: Write the script**

There is no meaningful unit test for a call to an image model: the output is an image judged by eye, and asserting on it would either be trivial or fabricated. The verification here is a real run against one file plus a cost readout.

```js
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
```

- [ ] **Step 2: Verify against a single file, to bound the spend**

```bash
mkdir -p /tmp/kp-one && cp ~/Downloads/parchant/animation-candidate.jpeg /tmp/kp-one/
node scripts/redraw-photos.mjs /tmp/kp-one /tmp/kp-redraw
```
Expected: one line ending in about `$0.0393`, then `total $0.04 across 1 image(s)`. Open `/tmp/kp-redraw/animation-candidate.png` and confirm it is a two-colour inked drawing with no invented border or signature. If a border or signature appears, tighten the last prompt line before running the full set.

- [ ] **Step 3: Note the replacement in the README**

Replace the `make-panels.sh` line in the README's run block with:

```bash
node scripts/redraw-photos.mjs ~/Downloads/parchant   # redraw photos as inked panels (~$0.04 each)
```

- [ ] **Step 4: Commit**

```bash
git add scripts/redraw-photos.mjs README.md
git commit -m "Replace posterize pipeline with model-redrawn poster panels"
```

---

### Task 12: Publish and document

**Files:**
- Modify: `scripts/publish-docs.sh`
- Modify: `README.md`

**Interfaces:**
- Consumes: `prototype/index.html` and `prototype/assets/`.
- Produces: `docs/` containing the new page as the landing page.

- [ ] **Step 1: Rewrite the publish script**

The old script made the canvas the landing page and inlined both prototypes. The scroll page references fonts and images relatively, so copying the directory is simpler and keeps the served bytes identical to what was tested.

```bash
#!/usr/bin/env bash
# Assemble docs/ for GitHub Pages.
# Pages serves from main:/docs, so docs/ is committed while build/ stays ignored.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Fail rather than publish a page that does not pass its own checks.
node scripts/check.mjs "file://$ROOT/prototype/index.html"

rm -rf docs
mkdir -p docs

# The scroll page is the direction. Assets are copied as-is: the page loads
# them relatively, so what is served is byte-identical to what was checked.
cp prototype/index.html docs/index.html
cp -R prototype/assets docs/assets

# The superseded canvas direction, kept reachable for comparison.
node scripts/inline.mjs canvas
cp build/parchant-canvas.html docs/canvas.html

# Skip Jekyll: these are plain files and underscore-prefixed names would be eaten.
touch docs/.nojekyll

# A mockup carrying unverified cast names does not belong in a search index.
cat > docs/robots.txt <<'EOF'
User-agent: *
Disallow: /
EOF

echo "docs/ assembled:"
find docs -type f | sort
```

- [ ] **Step 2: Run it**

Run: `./scripts/publish-docs.sh`
Expected: the check output, then `all checks passed`, then a file listing containing `docs/index.html`, `docs/canvas.html`, `docs/assets/fonts/*.woff2` and `docs/robots.txt`.

- [ ] **Step 3: Verify the published copy passes on its own**

Run: `node scripts/check.mjs "file://$PWD/docs/index.html"`
Expected: all checks pass. This catches a broken relative path in the copy, which is the failure mode this arrangement risks.

- [ ] **Step 4: Update the README**

Delete the "Two prototypes", "Navigation model", "Adventure framing" and "Design direction" sections entirely and put this in their place. Leave the GoOut section where it is but add the note below to the top of it. Leave "Open questions" and "Placeholder content" alone — Task 12 Step 6 handles those.

````markdown
## The page

`prototype/index.html` — a single scrolling page, no build step, no
dependencies. Seven colour bands you scroll through, in the order the client
asked for: program, repertoár, soubor, o nás, o prostoru, fotky.

`prototype/canvas.html` — the superseded direction: a pannable 2x2 comic map
you moved across instead of scrolling. Kept as a record, still published at
`/canvas.html`. Two things retired it: the client asked for a burger menu over
six named sections, which is a scroll-page structure and not a spatial one, and
the inspiration boards she then shared pointed at mid-century circus poster
rather than Foglar comic. The reasoning is in
`specs/2026-08-16-poster-press-scroll-design.md`.

## Run it

```bash
node scripts/fetch-fonts.mjs                  # download the four woff2 subsets
node scripts/redraw-photos.mjs ~/Downloads/parchant   # redraw photos as inked panels (~$0.04 each)
node scripts/check.mjs                        # assertions: contrast, overflow, content, metadata
node scripts/shot.mjs "file://$PWD/prototype/index.html" /tmp/kp.png 390 844
./scripts/publish-docs.sh                     # assemble docs/ for GitHub Pages
open -a "Brave Browser" prototype/index.html
```

`check.mjs` is the test suite. There is no framework: it drives a real headless
Brave over the DevTools protocol, so assertions run against computed styles and
real layout rather than a parsed string. `publish-docs.sh` refuses to publish a
page that does not pass it.

## Design direction

Poster press. The page is a stack of printed posters, so each section is a
colour band and scrolling reads as flipping through a pile. Circus appears as
structure only — perforated ticket edges, notched ribbon section heads, arrow
signs, star dividers — never as drawn tents or masks.

Palette, taken from the two colour boards the client shared, which propose the
same idea independently:

| Token | Hex | Where it goes |
|---|---|---|
| paper | `#FFFECD` | cream bands; text on deep red |
| ground | `#B0BC68` | olive bands |
| ground light | `#CDD78A` | lime bands |
| punch red | `#EB313F` | KP monogram, display type |
| cherry | `#AA0A27` | red body text and links |
| ink | `#1E1B14` | body text |

Two reds, deliberately. Punch red on cream is about 4.2:1 — enough for large
display type, short of the 4.5:1 body text needs — so it is display-only and
cherry carries anything small. Cream never sits on olive, which is about 2:1.
`check.mjs` enforces both rules and fails the build rather than trusting anyone
to remember them.

Outlined display type is exempt from the ratio check, because the ratio model
does not describe it: legibility comes from a hard ink edge on all sides. The
exemption is paid for by asserting the outline is actually present.

Deliberately single-theme. A printed poster is paper, so there is no dark mode.

Type is self-hosted Archivo Black and Archivo — two woff2 subsets each, latin
and latin-ext. latin-ext is the requirement that eliminates most display faces:
`ě š č ř ž ů ť ď ň` live in U+0100–017F and are usually the first glyphs a
display font drops. `check.mjs` measures whether they actually render rather
than trusting the subset declaration.

Photos are redrawn by an image model rather than filtered. The previous
pipeline posterized phone shots to two inks to make amateur capture read as
deliberate print; redrawing reinterprets instead, which is what actually fixes
the source material — phone photos with audience heads across the bottom third.
````

Add to the top of the GoOut section:

````markdown
**GoOut is no longer the source of truth.** The client's feedback of 2026-08-11
says the account is not under their management and they will arrange their own.
The page renders from `data/program.json`, which is ours. `fetch-goout.mjs`
stays as an optional refresh and nothing on the page depends on it running. The
rest of this section is kept because the API notes are hard-won and still true.
````

- [ ] **Step 5: Refresh the README's two stale list sections**

Replace the README's "Placeholder content" section with this, since most of it
is no longer placeholder — her real words arrived on 2026-08-14:

````markdown
## Still her words to write

Two things on the page are still holding space, both marked `data-placeholder`
in the markup so they are greppable:

- the claim under the logo, which is empty rather than invented
- the *O nás* prose

Everything else is her own text or verbatim from the company's i-divadlo
profile. Facts on the page that are true: two productions, one venue, premieres
30. 1. 2026 and 2. 5. 2025, 75 minutes without an interval, 6+.

One word to check before launch: her *Rychlé šípy* blurb reads "v nové size",
which is almost certainly meant to be "v nové verzi". It is left as she wrote
it.
````

Replace the "Cast spelling" bullet in "Open questions" with:

````markdown
- **Cast list.** Now compiled from the company's i-divadlo profile rather than
  read off a photograph of a poster, which corrected two spellings (Maxmilián
  Kocek, Matouš Vyšata) and removed one name that appears nowhere on the
  profile (Mikuláš Polák). Still needs confirming against the company's own
  list, along with Aliska's full billing name. `robots.txt` disallows
  everything until it is confirmed.
````

Delete the "Image URLs" open question only if the GoOut integration has been
dropped entirely; it is still live as an optional refresh, so keep it.

- [ ] **Step 6: Commit**

```bash
git add scripts/publish-docs.sh README.md docs
git commit -m "Publish the poster-press scroll page as the landing page"
```

---

## Verification

Full sweep, after Task 11:

```bash
node scripts/check.mjs
node scripts/shot.mjs "file://$PWD/prototype/index.html" /tmp/kp-390.png 390 844
node scripts/shot.mjs "file://$PWD/prototype/index.html" /tmp/kp-768.png 768 1024
node scripts/shot.mjs "file://$PWD/prototype/index.html" /tmp/kp-1440.png 1440 900
grep -c "data-placeholder" prototype/index.html   # expect 2, until the client sends her copy
```

## Still blocked on the client

These cannot be resolved in code and must go back to her:

1. The claim under the logo — still not sent, and is it separate from the tagline?
2. "v nové size" — did she mean "v nové verzi"?
3. The final palette and font from Zuzka.
4. The O nás prose.
5. Cast confirmation: Mikuláš Polák's absence, Aliska's full billing name, the Kocek and Vyšata spellings.
6. Should the October 2026 premiere be announced?
7. Facebook in the footer alongside Instagram?
8. Autumn dates on GoOut, so the Program band stops showing its empty state.
