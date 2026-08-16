# Multi-page Astro Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the single poster-press scroll page as a multi-page Astro site — one page per section, one page per production, one page per ensemble member — per the approved spec.

**Architecture:** Astro 7 static build at the repo root (`src/`, `public/`, output in `dist/`). All content lives in schema-validated content collections plus one shared layout; every page is static markup at build time. Verification stays the homegrown CDP suite: `scripts/check.mjs` builds the site, serves `dist/` over HTTP, and runs every check against every generated page at 320px and 390px. Astro is a build-time dependency only — the built output makes no third-party requests and contains no framework runtime.

**Tech Stack:** Astro ^7.2 (static output, content collections with zod schemas), vanilla CSS/JS in the output, Node ESM check scripts with zero npm dependencies of their own, headless Brave over CDP.

**Spec:** `specs/2026-08-17-multipage-site-design.md` (shell) + `specs/2026-08-16-poster-press-scroll-design.md` (content decisions, still binding). The plan argues from both; read them first.

## Global Constraints

- **Plans and specs never live in `docs/`.** `scripts/publish-docs.sh` runs `rm -rf docs`. Authoring anything there destroys it.
- **Never push to origin.** `main` is deliberately local-only. Commit locally; pushing is the user's call.
- **Language:** all user-facing copy is Czech. All code comments and commit messages are English. No emoji anywhere, including as status glyphs.
- **No third-party requests in the built output.** Fonts self-hosted in `public/fonts/`. No CDN links, no analytics. Astro as a devDependency is fine; its output must be self-contained.
- **Palette (exact, complete — `--red #EB313F` is dropped, do not reintroduce it):**
  ```css
  --cream:  #FFFECD;
  --lime:   #CDD78A;
  --olive:  #B0BC68;
  --cherry: #AA0A27;
  --ink:    #1E1B14;
  ```
- **Contrast rule:** cream text never sits on lime or olive (~2:1). Those grounds take `--ink`. Cherry on cream (~7.3:1) is fine at any size.
- **Type:** display = `"DM Serif Display"`, body = `"Archivo"`. Both self-hosted, latin + latin-ext. Archivo Black is retired; Prata is rejected (no latin-ext).
- **Forbidden strings — must appear on no page, ever:** `Pivařská`, `Aneta Kalertová`, `Mikuláš Polák`, `Višata`, `červánky`, `Hančilová`. Note: `Višata` (i) is the misspelling; `Vyšata` (y) is correct. `Maximilián Dolanský` keeps its "i" and `Maxmilián Kocek` does not — never normalise one to the other.
- **Verbatim client copy, character-exact:**
  - Pitch: `Divadelní soubor, který se nebojí provokovat. Jsme tu abychom bourali hranice a vytvářeli nezapomenutelné zážitky!` (the missing comma before "abychom" is hers — keep)
  - Šípy blurb: `Záhada slavných Foglarových Rychlých šípů v nové size od designera Šimona Lorka.` (`v nové size` is her wording, likely a typo for "verzi" — never silently correct it)
  - Press quotes are quotations from real named people: `ÚŽASNÝ!` stays in capitals, `určitě` stays lowercase.
- **Unverified facts stay out.** The October 2026 premiere is never announced. *Audience / Pivařská odysea* is omitted. Cast names carry a verification comment. Hra lásky shows a `90 %` badge and **zero** blockquotes — there is no review text and inventing one would fabricate a review.
- **Two placeholders, marked `data-placeholder` in markup:** the hero claim slot (empty) and the O nás prose (holding text).
- **Photo attribution:** only the Rychlé šípy photographs are identifiable. `hra.png` must NOT be captioned or attributed to Hra lásky. `hero.png` is captioned `Soubor`.
- **`prototype/` is not modified or deleted.** It is the previous deliverable, kept as-is (including its fonts). `scripts/shot.mjs` must keep working.
- **Footer links:** Instagram, i-divadlo.cz, GoOut. No Facebook.
- **`meta name="robots" noindex, nofollow` on every page** until the cast list is confirmed; `docs/robots.txt` disallows all.
- **Deployment is deferred:** no `base` path configured, links are root-relative. `file://` therefore cannot browse the built site — preview via `node scripts/serve.mjs dist` (Task 3 builds this).

### Route set (final, exact — trailing-slash directory format)

```
/                                        /soubor/prokop-zach/
/program/                                /soubor/zuzana-matuskova/
/repertoar/                              /soubor/ondrej-stupka/
/repertoar/rychle-sipy-a-zahada-klubovny/  /soubor/maximilian-dolansky/
/repertoar/hra-lasky-a-nahody/           /soubor/maxmilian-kocek/
/soubor/                                 /soubor/matous-vysata/
/o-nas/                                  /soubor/aliska/
/o-prostoru/                             /soubor/jiri-dlouhy/
/fotky/                                  /soubor/simon-fikar/
/404.html                                /soubor/simon-lorko/
                                         /soubor/marek-cimbal/
```

### Menu (6 items, this order, these labels)

Program, Repertoár, Soubor, O nás, O prostoru, Fotky — linking to `/program/`, `/repertoar/`, `/soubor/`, `/o-nas/`, `/o-prostoru/`, `/fotky/`.

---

## File Structure

| File | Responsibility |
|---|---|
| `package.json`, `package-lock.json` | Astro devDependency + scripts. Committed. |
| `astro.config.mjs` | Site URL, static output. |
| `tsconfig.json` | `extends astro/tsconfigs/base` — needed for `src/content.config.ts`. |
| `src/styles/global.css` | @font-face, tokens, reset, shared component CSS (header, burger, footer, ribbon, credits, press). One file — the site shares one visual system. |
| `src/components/KPMark.astro` | The drawn SVG mark, canonical paths, used by header, footer, favicon source. |
| `src/layouts/Base.astro` | Head (meta, OG, robots), header with condense behaviour, burger overlay + script, footer. Every page uses it. |
| `src/content.config.ts` | `productions` + `people` collections with zod schemas. |
| `src/content/productions/*.json` | Two production records. |
| `src/content/people.json` | Eleven person records. |
| `src/pages/…` | One `.astro` file per route (see route set). |
| `public/fonts/*.woff2` | Four subsets: DM Serif Display + Archivo, latin + latin-ext. |
| `public/assets/panels/*` | Photos, copied from `prototype/assets/panels/`. |
| `public/favicon.svg` | The mark alone. |
| `scripts/fetch-fonts.mjs` | Modify: new family list, new output dir. |
| `scripts/lib/browser.mjs` | Modify: add `withBrowser` (one browser, many navigations) + media emulation; keep `withPage` as a wrapper so `shot.mjs` is untouched. |
| `scripts/serve.mjs` | Create: dependency-free static server for `dist/`/`docs/`. |
| `scripts/check.mjs` | Rewrite: build, serve, enumerate routes, run generic checks on every page and page-specific checks per route, at 320px and 390px. |
| `scripts/publish-docs.sh` | Modify: gate on check.mjs, then `dist/` → `docs/`. |

**Task boundaries:** each task ends with `node scripts/check.mjs` green (from Task 3 on) and a commit. Page tasks are test-first: extend `EXPECTED_ROUTES` and `PAGE_CHECKS` in `check.mjs`, watch the suite fail, then build the page until it passes.

---

### Task 1: Astro scaffold

**Files:**
- Create: `package.json`, `astro.config.mjs`, `tsconfig.json`, `src/styles/global.css`, `src/pages/index.astro`
- Create: `public/assets/panels/` (copied photos)
- Modify: `.gitignore`

**Interfaces:**
- Produces: `npm run build` → `dist/`. `src/styles/global.css` with the token block every later task imports. Photos at `/assets/panels/<name>` (same filenames as `prototype/assets/panels/`).

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "parchanti-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "astro dev",
    "build": "astro build",
    "preview": "astro preview",
    "check": "node scripts/check.mjs"
  },
  "devDependencies": {
    "astro": "^7.2.2"
  }
}
```

- [ ] **Step 2: Write `astro.config.mjs`**

```js
// Static site. Deployment is deferred by decision: no base path is set, so
// links are root-relative and the built site must be previewed over HTTP
// (node scripts/serve.mjs dist), not file://.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://kolekceparchant.cz',
});
```

- [ ] **Step 3: Write `tsconfig.json`**

```json
{
  "extends": "astro/tsconfigs/base"
}
```

- [ ] **Step 4: Write `src/styles/global.css`** (tokens + reset; @font-face lands in Task 2)

```css
/* ---------------------------------------------------------------------------
   One visual system for the whole site, so it lives in one file.

   Palette from the client's colour boards: Lime Sherbet ground family plus
   Barbados Cherry. One red only - the previous punch red #EB313F is dropped
   (spec 2026-08-17). Cherry on cream is ~7.3:1 and passes at any size.
   Cream never sits on lime or olive (~2:1); those grounds take ink.
   scripts/check.mjs enforces the contrast on every page.

   Deliberately single-theme: printed poster, paper, no dark mode.
   --------------------------------------------------------------------------- */
:root {
  color-scheme: only light;

  --cream:  #FFFECD;
  --lime:   #CDD78A;
  --olive:  #B0BC68;
  --cherry: #AA0A27;
  --ink:    #1E1B14;

  --display: "DM Serif Display", Georgia, "Times New Roman", serif;
  --body: "Archivo", "Helvetica Neue", Helvetica, Arial, sans-serif;

  --measure: 34rem;
  --gutter: clamp(1.25rem, 5vw, 3rem);
  --band-padding: clamp(2.5rem, 8vw, 5rem);
}

* { box-sizing: border-box; }

html { scroll-padding-top: 4rem; }

body {
  margin: 0;
  background: var(--cream);
  color: var(--ink);
  font-family: var(--body);
  font-size: clamp(1rem, 0.95rem + 0.3vw, 1.125rem);
  line-height: 1.55;
  overflow-x: hidden;
}

img { max-width: 100%; height: auto; }

.display {
  font-family: var(--display);
  font-weight: 400;
  line-height: 1.02;
  letter-spacing: 0;
}

@media (prefers-reduced-motion: reduce) {
  * { animation: none !important; transition: none !important; }
}
```

- [ ] **Step 5: Write a minimal `src/pages/index.astro`** (replaced by the real homepage in Task 6; exists so the build and the check harness have a page)

```astro
---
import '../styles/global.css';
---
<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex, nofollow" />
  <title>Kolekce Parchant</title>
  <meta name="description" content="Kolekce Parchant je nezávislý divadelní soubor ze Studia Citadela v Praze. Rychlé šípy a záhada klubovny, Hra lásky a náhody." />
</head>
<body>
  <h1 class="display">Kolekce Parchant</h1>
  <p>Nezávislý divadelní soubor ze Studia Citadela, Klimentská 16, Praha 1. Stránka vzniká.</p>
</body>
</html>
```

- [ ] **Step 6: Copy photos into `public/`**

```bash
mkdir -p public/assets/panels
cp prototype/assets/panels/* public/assets/panels/
```

- [ ] **Step 7: Add `dist/` to `.gitignore`** (append the line `dist/`)

- [ ] **Step 8: Install and build**

```bash
npm install
npm run build
```
Expected: `dist/index.html` exists and contains `Kolekce Parchant`. Verify with `grep -c "Kolekce Parchant" dist/index.html` (non-zero).

- [ ] **Step 9: Commit** (include `package-lock.json` and `public/assets/panels/`)

```bash
git add package.json package-lock.json astro.config.mjs tsconfig.json src public .gitignore
git commit -m "Scaffold Astro static site with palette tokens"
```

---

### Task 2: Self-hosted fonts — DM Serif Display + Archivo

**Files:**
- Modify: `scripts/fetch-fonts.mjs`
- Create: `public/fonts/dm-serif-display-latin.woff2`, `public/fonts/dm-serif-display-latin-ext.woff2`, `public/fonts/archivo-latin.woff2`, `public/fonts/archivo-latin-ext.woff2`
- Modify: `src/styles/global.css` (prepend @font-face block)

**Interfaces:**
- Consumes: `src/styles/global.css` from Task 1.
- Produces: font families `"DM Serif Display"` (400) and `"Archivo"` (400–700) available site-wide at `/fonts/…`. The check suite's diacritics probe (Task 3) loads exactly these two family names.

- [ ] **Step 1: Update `scripts/fetch-fonts.mjs`**

In the existing file change only these two constants (leave the fetching logic as is):

```js
const OUT = new URL('../public/fonts/', import.meta.url);
```

```js
const FAMILIES = [
  // DM Serif Display replaces Archivo Black as the display face
  // (spec 2026-08-17). It ships latin-ext, which Prata - the closest match
  // to the client's board - does not; Czech display type is why that matters.
  { query: 'DM+Serif+Display', family: 'DM Serif Display', weight: '400', file: 'dm-serif-display' },
  { query: 'Archivo:wght@400..700', family: 'Archivo', weight: '400 700', file: 'archivo' },
];
```

And in the emitted `@font-face` template change the src line to a root-relative path (the site is multi-page, so relative paths would break on nested routes):

```js
      + `  src: url("/fonts/${name}") format("woff2");\n`
```

- [ ] **Step 2: Run it**

```bash
node scripts/fetch-fonts.mjs
```
Expected: four files listed with sizes, and an `@font-face` block printed. Verify the files are real woff2: `for f in public/fonts/*.woff2; do head -c4 "$f" | grep -q wOF2 && echo "ok $f" || echo "BAD $f"; done`

- [ ] **Step 3: Paste the printed `@font-face` block at the top of `src/styles/global.css`** (above the `:root` comment banner). Four blocks total: two families × two subsets, each with its `unicode-range`.

- [ ] **Step 4: Build and verify fonts are copied**

```bash
npm run build && ls dist/fonts
```
Expected: the four woff2 files.

- [ ] **Step 5: Commit**

```bash
git add scripts/fetch-fonts.mjs public/fonts src/styles/global.css
git commit -m "Self-host DM Serif Display and Archivo, latin and latin-ext"
```

---

### Task 3: Multi-page check harness

**Files:**
- Modify: `scripts/lib/browser.mjs` (add `withBrowser`, reimplement `withPage` on top of it)
- Create: `scripts/serve.mjs`
- Rewrite: `scripts/check.mjs`

**Interfaces:**
- Consumes: `dist/` from `npm run build`.
- Produces:
  - `withBrowser(fn)` → `fn(visit)` where `visit(url, options, pageFn)` navigates the one shared browser and calls `pageFn(evaluate, screenshot)`. Options: `{ width, height, mobile, settle, reducedMotion }`.
  - `staticServer(rootDir)` exported from `serve.mjs`, returns a `node:http` Server (not yet listening).
  - `check.mjs` structure that later tasks extend: `EXPECTED_ROUTES` (string array), `GENERIC_CHECKS` (run on every route), `PAGE_CHECKS` (object: route → checks). A check is `{ name, expression, verify }` exactly as in the old suite.

- [ ] **Step 1: Refactor `scripts/lib/browser.mjs`**

Keep the file's top half (BRAVE path, PORT, `wait`, `debuggerUrl`, `Client`) unchanged. Replace `withPage` with:

```js
// One browser, many page visits. The multi-page suite visits ~21 routes per
// viewport width; spawning Brave per route would dominate the runtime, so the
// suite spawns once per width and navigates. withPage stays as a wrapper so
// shot.mjs keeps working unchanged.
export async function withBrowser(fn) {
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
    await client.send('Page.enable', {}, sessionId);

    const visit = async (url, options, pageFn) => {
      const { width = 390, height = 844, mobile = true, settle = 600, reducedMotion = false } = options ?? {};

      await client.send('Emulation.setDeviceMetricsOverride', {
        width, height, deviceScaleFactor: 2, mobile,
      }, sessionId);
      // Emulated, not inherited from the OS, so the reduced-motion checks are
      // deterministic on any machine.
      await client.send('Emulation.setEmulatedMedia', {
        features: [{ name: 'prefers-reduced-motion', value: reducedMotion ? 'reduce' : '' }],
      }, sessionId);

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

      return pageFn(evaluate, screenshot);
    };

    return await fn(visit);
  } finally {
    // Wait for the process to actually exit, not just for the kill signal to
    // be sent: a second launch would race this one for the shared
    // --user-data-dir lock. Timeout is a fallback if 'exit' never fires.
    const exited = new Promise((resolve) => browser.once('exit', resolve));
    browser.kill();
    await Promise.race([exited, wait(2000)]);
  }
}

export function withPage(url, options, fn) {
  return withBrowser((visit) => visit(url, options, fn));
}
```

- [ ] **Step 2: Verify `shot.mjs` still works**

```bash
node scripts/shot.mjs "file://$PWD/prototype/index.html" /tmp/claude-501/-Users-joker-dev-parchanti/*/scratchpad/shot-regression.png 2>/dev/null || node scripts/shot.mjs
```
Run `scripts/shot.mjs` however its own usage line says (read its header first); expected: a PNG is produced, no error.

- [ ] **Step 3: Write `scripts/serve.mjs`**

```js
// Dependency-free static server for the built site.
//
// The site's links are root-relative (no base path until a host is chosen),
// so file:// cannot follow them between pages. Both the check suite and local
// preview go over HTTP instead.
//
//   node scripts/serve.mjs [dir] [port]     # preview: default dist, 4173
//
// check.mjs imports staticServer() and picks its own port.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain; charset=utf-8',
  '.ico': 'image/x-icon',
};

export function staticServer(rootDir) {
  const root = resolve(rootDir);

  return createServer(async (request, response) => {
    let pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    // A directory URL without the trailing slash still resolves, matching how
    // real static hosts redirect; no extension means it can't be a file.
    else if (!extname(pathname)) pathname += '/index.html';

    const file = resolve(join(root, pathname));
    // join() already collapses ../ segments; this guard refuses anything that
    // escaped the root anyway.
    if (file !== root && !file.startsWith(root + sep)) {
      response.writeHead(403).end();
      return;
    }

    try {
      const body = await readFile(file);
      response.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
      response.end(body);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain' });
      response.end('not found');
    }
  });
}

// Run directly: serve for preview.
if (process.argv[1] === new URL(import.meta.url).pathname) {
  const dir = process.argv[2] ?? 'dist';
  const port = Number(process.argv[3] ?? 4173);
  staticServer(dir).listen(port, () => {
    console.log(`serving ${dir}/ at http://127.0.0.1:${port}/`);
  });
}
```

- [ ] **Step 4: Rewrite `scripts/check.mjs`**

The old single-page suite is replaced wholesale (git history keeps it). New file:

```js
// Assertion harness for the built site.
//
// No test framework on purpose: the deliverable is static HTML and the only
// dependency worth having is a real browser. The suite builds the site so it
// can never check a stale dist/, discovers every generated page, and runs
// every generic check against every page at both 320px (narrowest phone in
// real use) and 390px. Page-specific checks ride along on their route.
//
//   node scripts/check.mjs

import { execFileSync } from 'node:child_process';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { staticServer } from './serve.mjs';
import { withBrowser } from './lib/browser.mjs';

const DIST = new URL('../dist', import.meta.url).pathname;
const PORT = 4517;

// --- 1. Build. A check suite that trusts a pre-existing dist/ can pass on
// stale output; building here makes that impossible.
execFileSync('npx', ['astro', 'build'], { stdio: 'inherit' });

// --- 2. Discover routes from what the build actually emitted.
function discoverRoutes(dir, prefix = '/') {
  const routes = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      routes.push(...discoverRoutes(path, `${prefix}${entry}/`));
    } else if (entry === 'index.html') {
      routes.push(prefix);
    } else if (entry === '404.html') {
      routes.push('/404.html');
    }
  }
  return routes.sort();
}

// The full expected set. Astro generates pages, so a route can silently
// disappear while every remaining page still passes - this list is the guard.
// Page tasks extend it as routes land; by the last page task it is complete.
const EXPECTED_ROUTES = [
  '/',
].sort();

const actualRoutes = discoverRoutes(DIST);
if (JSON.stringify(actualRoutes) !== JSON.stringify(EXPECTED_ROUTES)) {
  const missing = EXPECTED_ROUTES.filter((route) => !actualRoutes.includes(route));
  const extra = actualRoutes.filter((route) => !EXPECTED_ROUTES.includes(route));
  console.error('FAIL  route set mismatch');
  if (missing.length) console.error(`      missing: ${missing.join(' ')}`);
  if (extra.length) console.error(`      unexpected: ${extra.join(' ')}`);
  process.exit(1);
}
console.log(`pass  route set matches (${actualRoutes.length} routes)`);

// --- 3. Checks. Same shape as the previous suite: an expression evaluated in
// the page, a verify function that returns null (pass) or a problem string.

const GENERIC_CHECKS = [];
function generic(name, expression, verify) {
  GENERIC_CHECKS.push({ name, expression, verify });
}

// Page-specific checks, keyed by route. Extended by later tasks.
const PAGE_CHECKS = {};
function onPage(route, name, expression, verify) {
  (PAGE_CHECKS[route] ??= []).push({ name, expression, verify });
}

generic(
  'page has a title',
  `document.title`,
  (title) => (title && title.trim().length > 0 ? null : `title was ${JSON.stringify(title)}`),
);

generic(
  'Czech diacritics render in both faces',
  `(async () => {
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;font-size:64px;white-space:pre';
    document.body.append(probe);
    const widthOf = (text, family) => {
      probe.style.fontFamily = family;
      probe.textContent = text;
      return probe.getBoundingClientRect().width;
    };
    // If the face lacks a glyph the browser substitutes from the fallback;
    // comparing the diacritic string in face+fallback against fallback alone
    // catches the swap. document.fonts.load() forces the fetch first -
    // without it this measurement races the async @font-face load and always
    // reads fallback metrics.
    const result = {};
    for (const family of ['"DM Serif Display"', '"Archivo"']) {
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

generic(
  'text meets WCAG contrast against its ground',
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
    for (const el of document.querySelectorAll('p, li, a, dd, dt, figcaption, small, span, h1, h2, h3, button, blockquote, footer')) {
      if (!el.textContent.trim()) continue;
      if (el.querySelector('p, li, h1, h2, h3, blockquote')) continue; // containers, not leaves
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      const size = parseFloat(style.fontSize);
      const weight = Number(style.fontWeight) || 400;
      // WCAG large text: 24px, or 18.66px at 700+.
      const isLarge = size >= 24 || (size >= 18.66 && weight >= 700);
      const contrast = ratio(style.color, backdrop(el));
      const needed = isLarge ? 3 : 4.5;
      if (contrast < needed) {
        problems.push(el.tagName + '.' + (el.className || '?') + ' ' + contrast.toFixed(2) + ':1 needs ' + needed);
      }
    }
    return JSON.stringify([...new Set(problems)].slice(0, 10));
  })()`,
  (raw) => {
    const problems = JSON.parse(raw);
    return problems.length ? problems.join('; ') : null;
  },
);

generic(
  'nothing overflows horizontally',
  `(() => {
    const inScroller = (el) => {
      for (let node = el.parentElement; node; node = node.parentElement) {
        if (/(auto|scroll)/.test(getComputedStyle(node).overflowX)) return true;
      }
      return false;
    };
    // innerWidth is not a safe yardstick: browsers silently widen the layout
    // viewport to absorb unbreakable overflow, so innerWidth grows with the
    // bug. documentElement.clientWidth stays pinned to the requested width.
    const clientWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;

    const problems = [];
    if (scrollWidth > clientWidth + 1) {
      problems.push('document scrolls horizontally: scrollWidth ' + scrollWidth + ' > clientWidth ' + clientWidth);
    }
    for (const el of document.querySelectorAll('body *')) {
      const box = el.getBoundingClientRect();
      if (box.width === 0 && box.height === 0) continue;
      if (inScroller(el)) continue;
      if (box.right > clientWidth + 1) problems.push((el.className || el.tagName) + ' right+' + Math.round(box.right - clientWidth));
      if (box.left < -1) problems.push((el.className || el.tagName) + ' left' + Math.round(box.left));
    }
    return JSON.stringify([...new Set(problems)].slice(0, 10));
  })()`,
  (raw) => {
    const problems = JSON.parse(raw);
    return problems.length ? problems.join('; ') : null;
  },
);

generic(
  'no forbidden name or undisclosed premiere appears',
  `JSON.stringify(['Pivařská', 'Aneta Kalertová', 'Mikuláš Polák', 'Višata', 'červánky', 'Hančilová']
     .filter((needle) => document.documentElement.textContent.includes(needle)))`,
  (raw) => {
    const found = JSON.parse(raw);
    return found.length
      ? `forbidden on this page: ${found.join(', ')} — removed names must stay removed and the October premiere must not be announced`
      : null;
  },
);

generic(
  'page carries real static markup, not script-built content',
  `document.querySelector('main')?.textContent.trim().length ?? document.body.textContent.trim().length`,
  (length) => (length >= 40 ? null : `main text is ${length} chars — social scrapers never run JS, so thin markup previews blank`),
);

generic(
  'every internal link resolves to a generated route',
  `JSON.stringify([...document.querySelectorAll('a[href^="/"]')]
     .map((a) => a.getAttribute('href').split('#')[0]))`,
  (raw) => {
    const hrefs = JSON.parse(raw);
    const known = new Set(EXPECTED_ROUTES);
    const dead = [...new Set(hrefs)].filter((href) => {
      const normalised = href.endsWith('/') || href.includes('.') ? href : `${href}/`;
      return !known.has(normalised);
    });
    return dead.length ? `dead internal links: ${dead.join(' ')}` : null;
  },
);

generic(
  'social metadata is present',
  `JSON.stringify({
    ogTitle: (document.querySelector('meta[property="og:title"]')?.content ?? '').length,
    description: (document.querySelector('meta[name="description"]')?.content ?? '').length,
    robots: document.querySelector('meta[name="robots"]')?.content ?? null,
  })`,
  (raw) => {
    const meta = JSON.parse(raw);
    if (meta.ogTitle < 5) return 'og:title missing';
    if (meta.description < 40) return 'meta description missing or too short';
    if (!/noindex/.test(meta.robots ?? '')) return 'robots noindex is missing — cast list is not confirmed yet';
    return null;
  },
);

// --- 4. Run everything at both widths, one browser per width.
const widths = [320, 390];
const failures = [];

const server = staticServer(DIST);
await new Promise((resolve) => server.listen(PORT, resolve));

try {
  for (const width of widths) {
    await withBrowser(async (visit) => {
      for (const route of EXPECTED_ROUTES) {
        const url = `http://127.0.0.1:${PORT}${route}`;
        const pageChecks = [...GENERIC_CHECKS, ...(PAGE_CHECKS[route] ?? [])];
        await visit(url, { width, height: 844 }, async (evaluate) => {
          for (const { name, expression, verify } of pageChecks) {
            let problem;
            try {
              problem = verify(await evaluate(expression));
            } catch (error) {
              problem = error.message;
            }
            const label = `[${width}px ${route}] ${name}`;
            console.log(`${problem ? 'FAIL' : 'pass'}  ${label}${problem ? ` — ${problem}` : ''}`);
            if (problem) failures.push(label);
          }
        });
      }
    });
  }
} finally {
  server.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nall checks passed: ${EXPECTED_ROUTES.length} routes x ${widths.length} widths`);
```

- [ ] **Step 5: Run the suite green**

```bash
node scripts/check.mjs
```
Expected: route set passes with 1 route, all generic checks pass on `/` at both widths.

- [ ] **Step 6: Negative control — prove the guards can fail**

Temporarily add the word `Pivařská` to `src/pages/index.astro` body text, run `node scripts/check.mjs`, and confirm the forbidden-strings check FAILS. Then temporarily change one `EXPECTED_ROUTES` entry to `'/nonexistent/'` and confirm the route-set check fails. Revert both, run once more, confirm green.

- [ ] **Step 7: Commit**

```bash
git add scripts/lib/browser.mjs scripts/serve.mjs scripts/check.mjs
git commit -m "Rewrite check suite for multi-page build: shared browser, static server, per-route checks"
```

---

### Task 4: KP mark, base layout, header, burger, footer

**Files:**
- Create: `src/components/KPMark.astro`, `src/layouts/Base.astro`, `public/favicon.svg`
- Modify: `src/styles/global.css` (append layout CSS), `src/pages/index.astro` (wrap in layout), `scripts/check.mjs` (add checks first)

**Interfaces:**
- Consumes: tokens and fonts from Tasks 1–2; `onPage`/`generic` registries from Task 3.
- Produces: `<Base title="…" description="…">` layout wrapping `<main>` content, with a named `head` slot for extra head tags (used once, for homepage JSON-LD). `<KPMark />` component. CSS classes later tasks use: `.page`, `.page__inner`, `.page-heading`, `.prose`, `.credits`, `.link`.

- [ ] **Step 1: Add the failing checks to `scripts/check.mjs`** (after the existing `generic(...)` calls)

```js
onPage('/',
  'nav overlay: closed at rest, opens, Escape closes, focus traps',
  `(async () => {
    const burger = document.querySelector('.burger');
    const nav = document.querySelector('#nav');
    const closed = burger.getAttribute('aria-expanded') === 'false' && !nav.hasAttribute('data-open');
    burger.click();
    const opened = burger.getAttribute('aria-expanded') === 'true' && nav.hasAttribute('data-open');
    const dialog = nav.getAttribute('role') === 'dialog' && nav.getAttribute('aria-modal') === 'true';
    const links = [...nav.querySelectorAll('.nav__link')];
    // Trap: Tab on the last link wraps to the first, Shift+Tab on the first
    // wraps to the last. The overlay is the entire navigation model.
    links[links.length - 1].focus();
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    const wrapsForward = document.activeElement === links[0];
    links[0].focus();
    nav.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    const wrapsBack = document.activeElement === links[links.length - 1];
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const reclosed = burger.getAttribute('aria-expanded') === 'false' && !nav.hasAttribute('data-open');
    const focusReturned = document.activeElement === burger;
    return JSON.stringify({ closed, opened, dialog, wrapsForward, wrapsBack, reclosed, focusReturned });
  })()`,
  (raw) => {
    const bad = Object.entries(JSON.parse(raw)).filter(([, ok]) => !ok).map(([name]) => name);
    return bad.length ? `failed: ${bad.join(', ')}` : null;
  },
);

onPage('/',
  'nav lists the six section pages in order',
  `JSON.stringify([...document.querySelectorAll('#nav .nav__link')]
     .map((a) => a.getAttribute('href') + '|' + a.textContent.trim()))`,
  (raw) => {
    const expected = [
      '/program/|Program', '/repertoar/|Repertoár', '/soubor/|Soubor',
      '/o-nas/|O nás', '/o-prostoru/|O prostoru', '/fotky/|Fotky',
    ];
    const actual = JSON.parse(raw);
    return JSON.stringify(actual) === JSON.stringify(expected) ? null : `got ${JSON.stringify(actual)}`;
  },
);

onPage('/',
  'masthead condenses on scroll and anchors clear the condensed bar',
  `(async () => {
    const masthead = document.querySelector('.masthead');
    const name = document.querySelector('.masthead__name');
    const frame = () => new Promise((resolve) => requestAnimationFrame(resolve));
    // The page may be short while under construction; the behaviour under
    // test is scroll-driven, so guarantee there is somewhere to scroll to.
    document.body.style.minHeight = '300vh';
    window.scrollTo(0, 0);
    await frame(); await frame();
    const fullHeight = masthead.getBoundingClientRect().height;
    const nameVisibleAtTop = getComputedStyle(name).display !== 'none';
    window.scrollTo(0, 600);
    await frame(); await frame(); await new Promise((resolve) => setTimeout(resolve, 350));
    const condensed = masthead.hasAttribute('data-condensed');
    const condensedHeight = masthead.getBoundingClientRect().height;
    const nameHiddenAfterScroll = getComputedStyle(name).display === 'none';
    const scrollPaddingTop = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    window.scrollTo(0, 0);
    document.body.style.minHeight = '';
    return JSON.stringify({ fullHeight, nameVisibleAtTop, condensed, condensedHeight, nameHiddenAfterScroll, scrollPaddingTop });
  })()`,
  (raw) => {
    const s = JSON.parse(raw);
    if (!s.nameVisibleAtTop) return 'the full lockup name is not visible at the top';
    if (!s.condensed) return 'masthead never gained data-condensed after scrolling';
    if (!s.nameHiddenAfterScroll) return 'the name did not drop away when condensed';
    if (s.condensedHeight >= s.fullHeight) return `condensed ${s.condensedHeight}px is not smaller than full ${s.fullHeight}px`;
    // The offset that matters is the condensed height - that is the state in
    // effect once the page has scrolled to an anchor.
    if (s.scrollPaddingTop < s.condensedHeight) return `scroll-padding-top ${s.scrollPaddingTop}px is under the condensed masthead ${s.condensedHeight}px`;
    return null;
  },
);

onPage('/',
  'footer carries the three links and the address, no Facebook',
  `JSON.stringify({
    instagram: Boolean(document.querySelector('.footer a[href*="instagram.com/kolekce_parchant"]')),
    idivadlo: Boolean(document.querySelector('.footer a[href*="i-divadlo.cz/divadlo/kolekce-parchant"]')),
    goout: Boolean(document.querySelector('.footer a[href*="goout.net"]')),
    facebook: Boolean(document.querySelector('a[href*="facebook"]')),
    address: document.querySelector('.footer').textContent.includes('Klimentská 16'),
  })`,
  (raw) => {
    const f = JSON.parse(raw);
    if (!f.instagram || !f.idivadlo || !f.goout) return 'a footer link is missing';
    if (f.facebook) return 'Facebook link present — the client never requested one';
    if (!f.address) return 'address missing from footer';
    return null;
  },
);

onPage('/',
  'homepage carries TheaterGroup JSON-LD and a favicon link',
  `JSON.stringify({
    schemaType: JSON.parse(document.querySelector('script[type="application/ld+json"]')?.textContent ?? '{}')['@type'] ?? null,
    favicon: document.querySelector('link[rel="icon"]')?.getAttribute('href') ?? null,
  })`,
  (raw) => {
    const m = JSON.parse(raw);
    if (m.schemaType !== 'TheaterGroup') return `schema @type was ${JSON.stringify(m.schemaType)}`;
    if (m.favicon !== '/favicon.svg') return `favicon href was ${JSON.stringify(m.favicon)}`;
    return null;
  },
);
```

And after the main width loop (before the `failures.length` exit block), the reduced-motion visit — a separate browser because it needs different media emulation:

```js
// The condense transition must be suppressed under prefers-reduced-motion:
// it snaps instead of animating. Separate visit: media emulation is
// per-navigation, so this cannot ride inside the main loop.
await withBrowser(async (visit) => {
  await visit(`http://127.0.0.1:${PORT}/`, { width: 390, height: 844, reducedMotion: true }, async (evaluate) => {
    const duration = await evaluate(
      `getComputedStyle(document.querySelector('.masthead__home svg')).transitionDuration`,
    );
    const problem = /^0s(, 0s)*$/.test(duration) ? null : `transition-duration is ${duration} under reduced motion`;
    console.log(`${problem ? 'FAIL' : 'pass'}  [reduced-motion /] condense snaps${problem ? ` — ${problem}` : ''}`);
    if (problem) failures.push('reduced motion');
  });
});
```

- [ ] **Step 2: Run `node scripts/check.mjs` — expect FAIL** on every new `/` check (no `.burger`, no `.masthead`, no footer yet).

- [ ] **Step 3: Write `src/components/KPMark.astro`** — the canonical mark. Stroked skeleton drawn three times: ink extrusion offset down-right, cherry body, cream inline at a quarter weight. No sparkles.

```astro
---
// The KP mark. Lettering drawn as SVG, not set in a typeface: a stroked
// skeleton drawn twice (ink extrusion offset down-right, cherry body) plus a
// thin cream inline. The swash rises off the P. Size is controlled by the
// consumer via CSS height on the svg.
---
<svg viewBox="0 0 250 160" aria-hidden="true" fill="none" stroke-linecap="butt" stroke-linejoin="miter">
  <g transform="translate(12,12)" stroke="#1E1B14" stroke-width="26">
    <path d="M30,44 V136" /><path d="M30,92 L88,44" /><path d="M30,92 L88,136" />
    <path d="M132,44 V136" /><path d="M132,44 H162 A30,30 0 0 1 162,104 H132" />
    <path d="M132,44 V20 C132,6 156,4 162,18" />
  </g>
  <g stroke="#AA0A27" stroke-width="26">
    <path d="M30,44 V136" /><path d="M30,92 L88,44" /><path d="M30,92 L88,136" />
    <path d="M132,44 V136" /><path d="M132,44 H162 A30,30 0 0 1 162,104 H132" />
    <path d="M132,44 V20 C132,6 156,4 162,18" />
  </g>
  <g stroke="#FFFECD" stroke-width="6">
    <path d="M30,44 V136" /><path d="M30,92 L88,44" /><path d="M30,92 L88,136" />
    <path d="M132,44 V136" /><path d="M132,44 H162 A30,30 0 0 1 162,104 H132" />
    <path d="M132,44 V20 C132,6 156,4 162,18" />
  </g>
</svg>
```

Colours are literal, not tokens: the mark is a fixed piece of lettering that must survive being copied into a favicon or an avatar where the stylesheet does not follow.

- [ ] **Step 4: Write `public/favicon.svg`** — the same SVG content as the component's markup (copy the `<svg …>…</svg>` element verbatim into a standalone file, adding `xmlns="http://www.w3.org/2000/svg"` to the root tag).

- [ ] **Step 5: Append layout CSS to `src/styles/global.css`**

```css
/* --- masthead: full lockup at top, mark + Menu once scrolled ------------- */
.masthead {
  position: sticky;
  top: 0;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.7rem var(--gutter);
  background: var(--cream);
  border-bottom: 3px solid var(--ink);
}

.masthead__home { display: flex; align-items: center; gap: 0.6rem; text-decoration: none; }

.masthead__home svg { height: 2.4rem; width: auto; display: block; transition: height 0.2s ease; }

.masthead__name { font-family: var(--display); font-size: 1.3rem; line-height: 1; color: var(--ink); }

.masthead[data-condensed] { padding-block: 0.45rem; }
.masthead[data-condensed] .masthead__home svg { height: 1.6rem; }
.masthead[data-condensed] .masthead__name { display: none; }

/* Sentinel the IntersectionObserver watches; out of flow, invisible. */
.masthead-sentinel { position: absolute; top: 0; width: 1px; height: 1px; }

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

/* Bars drawn as gradients: fewer nodes, and the open state swaps one value. */
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
    linear-gradient(var(--cream) 0 0) 0 50% / 100% 3px no-repeat;
}

/* --- full-screen nav overlay --------------------------------------------- */
.nav {
  position: fixed;
  inset: 0;
  z-index: 4;
  display: none;
  place-content: center;
  padding: var(--gutter);
  background: var(--cherry);
  /* On the wrapper, not only the links, so <li> nodes never fall back to the
     inherited ink body colour against cherry. */
  color: var(--cream);
}

.nav[data-open] { display: grid; }

.nav__list { margin: 0; padding: 0; list-style: none; display: grid; gap: clamp(0.5rem, 2vw, 1rem); }

.nav__link {
  font-family: var(--display);
  font-size: clamp(2.2rem, 10vw, 4.5rem);
  line-height: 1.15;
  color: var(--cream);
  text-decoration: none;
}

.nav__link:hover,
.nav__link:focus-visible { color: var(--lime); }

.nav__link[aria-current="page"] { text-decoration: underline; text-underline-offset: 0.15em; }

/* --- page scaffold -------------------------------------------------------- */
.page { padding: var(--band-padding) var(--gutter); }

.page__inner { max-width: 68rem; margin-inline: auto; }

.page-heading {
  margin: 0 0 2rem;
  font-size: clamp(2.4rem, 9vw, 4rem);
  color: var(--cherry);
}

.prose { max-width: var(--measure); }
.prose p { margin: 0 0 1em; text-wrap: pretty; }

.link { color: var(--cherry); font-weight: 700; text-underline-offset: 0.2em; }

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

/* --- footer ---------------------------------------------------------------- */
.footer { padding: var(--band-padding) var(--gutter); background: var(--ink); color: var(--cream); }

.footer svg { height: 3rem; width: auto; display: block; margin-bottom: 1.5rem; }

.footer__links { margin: 0 0 1.5rem; padding: 0; list-style: none; display: grid; gap: 0.5rem; }

.footer__links a { color: var(--cream); font-weight: 700; text-underline-offset: 0.2em; }

.footer__address { margin: 0; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.08em; }
```

- [ ] **Step 6: Write `src/layouts/Base.astro`**

```astro
---
import '../styles/global.css';
import KPMark from '../components/KPMark.astro';

interface Props {
  title: string;
  description: string;
}

const { title, description } = Astro.props;

const MENU = [
  { href: '/program/', label: 'Program' },
  { href: '/repertoar/', label: 'Repertoár' },
  { href: '/soubor/', label: 'Soubor' },
  { href: '/o-nas/', label: 'O nás' },
  { href: '/o-prostoru/', label: 'O prostoru' },
  { href: '/fotky/', label: 'Fotky' },
];

const currentPath = Astro.url.pathname;
---
<!doctype html>
<html lang="cs">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <!-- Cast names are still unverified against the company's own list. -->
  <meta name="robots" content="noindex, nofollow" />
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

  <meta property="og:type" content="website" />
  <meta property="og:locale" content="cs_CZ" />
  <meta property="og:site_name" content="Kolekce Parchant" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <!-- Relative path on purpose: the domain is not live yet. Change to an
       absolute https://kolekceparchant.cz/... URL at launch, since most
       scrapers will not resolve a relative one. -->
  <meta property="og:image" content="/assets/panels/hero.png" />
  <meta name="twitter:card" content="summary_large_image" />

  <slot name="head" />
</head>
<body>

<div class="masthead-sentinel" aria-hidden="true"></div>

<header class="masthead">
  <a class="masthead__home" href="/" aria-label="Kolekce Parchant, domů">
    <KPMark />
    <span class="masthead__name">Kolekce Parchant</span>
  </a>
  <button class="burger" type="button" aria-expanded="false" aria-controls="nav">
    <span class="burger__label">Menu</span>
    <span class="burger__bars" aria-hidden="true"></span>
  </button>
</header>

<nav class="nav" id="nav" role="dialog" aria-modal="true" aria-label="Hlavní navigace">
  <ul class="nav__list">
    {MENU.map((item) => (
      <li>
        <a
          class="nav__link"
          href={item.href}
          aria-current={currentPath === item.href ? 'page' : undefined}
        >{item.label}</a>
      </li>
    ))}
  </ul>
</nav>

<main>
  <slot />
</main>

<footer class="footer">
  <div class="page__inner">
    <KPMark />
    <ul class="footer__links">
      <li><a href="https://www.instagram.com/kolekce_parchant">Instagram</a></li>
      <li><a href="https://www.i-divadlo.cz/divadlo/kolekce-parchant">i-divadlo.cz</a></li>
      <li><a href="https://goout.net/cs/kolekce-parchant/pzpmtpg/">Vstupenky na GoOut</a></li>
    </ul>
    <p class="footer__address">Studio Citadela &middot; Klimentská 16 &middot; Praha 1</p>
  </div>
</footer>

<script>
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

  // Trap Tab inside the overlay while it is open. The overlay is full-bleed,
  // so letting focus escape underneath makes it invisible to a sighted
  // keyboard user.
  nav.addEventListener('keydown', (event) => {
    if (event.key !== 'Tab') return;
    const links = [...nav.querySelectorAll('.nav__link')];
    const index = links.indexOf(document.activeElement);
    if (index === -1) return;
    if (event.shiftKey && index === 0) {
      event.preventDefault();
      links[links.length - 1].focus();
    } else if (!event.shiftKey && index === links.length - 1) {
      event.preventDefault();
      links[0].focus();
    }
  });

  // Condense the masthead once the page scrolls: the name drops away and the
  // mark steps down (CSS handles both off data-condensed). The transition is
  // killed globally under prefers-reduced-motion, so it snaps there.
  const masthead = document.querySelector('.masthead');
  new IntersectionObserver(([entry]) => {
    masthead.toggleAttribute('data-condensed', !entry.isIntersecting);
  }).observe(document.querySelector('.masthead-sentinel'));
</script>
</body>
</html>
```

- [ ] **Step 7: Wrap the placeholder homepage in the layout** — replace `src/pages/index.astro` with:

```astro
---
import Base from '../layouts/Base.astro';

const description = 'Kolekce Parchant je nezávislý divadelní soubor ze Studia Citadela v Praze. Rychlé šípy a záhada klubovny, Hra lásky a náhody.';
---
<Base title="Kolekce Parchant" description={description}>
  <script slot="head" type="application/ld+json" is:inline set:html={JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'TheaterGroup',
    name: 'Kolekce Parchant',
    url: 'https://kolekceparchant.cz',
    location: {
      '@type': 'PerformingArtsTheater',
      name: 'Studio Citadela',
      address: {
        '@type': 'PostalAddress',
        streetAddress: 'Klimentská 16',
        addressLocality: 'Praha 1',
        addressCountry: 'CZ',
      },
    },
    sameAs: [
      'https://www.instagram.com/kolekce_parchant',
      'https://www.i-divadlo.cz/divadlo/kolekce-parchant',
    ],
  })} />

  <section class="page">
    <div class="page__inner">
      <h1 class="display page-heading">Kolekce Parchant</h1>
      <p class="prose">Nezávislý divadelní soubor ze Studia Citadela, Klimentská 16, Praha 1. Stránka vzniká.</p>
    </div>
  </section>
</Base>
```

The nav now points at six routes that do not exist yet, and the *"every internal link resolves"* generic check would rightly fail on them. So this task also creates the six section pages as **stubs** — the menu is never a lie, and this task's gate stays green:

Create `src/pages/program.astro`, `src/pages/repertoar/index.astro`, `src/pages/soubor/index.astro`, `src/pages/o-nas.astro`, `src/pages/o-prostoru.astro`, `src/pages/fotky.astro`, each with this identical stub content (adjusting the two strings per page — heading and title):

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Program — Kolekce Parchant" description="Termíny představení souboru Kolekce Parchant ve Studiu Citadela v Praze.">
  <section class="page">
    <div class="page__inner">
      <h1 class="display page-heading">Program</h1>
      <p class="prose">Obsah stránky vzniká. Zatím se podívejte na náš Instagram nebo GoOut.</p>
    </div>
  </section>
</Base>
```

(For `repertoar/index.astro` and `soubor/index.astro` the import path is `../../layouts/Base.astro`.)

Titles/headings/descriptions per stub:

| File | title | heading | description |
|---|---|---|---|
| `program.astro` | `Program — Kolekce Parchant` | `Program` | `Termíny představení souboru Kolekce Parchant ve Studiu Citadela v Praze.` |
| `repertoar/index.astro` | `Repertoár — Kolekce Parchant` | `Repertoár` | `Inscenace souboru Kolekce Parchant: Rychlé šípy a záhada klubovny, Hra lásky a náhody.` |
| `soubor/index.astro` | `Soubor — Kolekce Parchant` | `Soubor` | `Lidé souboru Kolekce Parchant — herci a tvůrci nezávislého divadla ze Studia Citadela.` |
| `o-nas.astro` | `O nás — Kolekce Parchant` | `O nás` | `Kolekce Parchant je nezávislý divadelní soubor, který hraje ve Studiu Citadela v Praze.` |
| `o-prostoru.astro` | `O prostoru — Kolekce Parchant` | `O prostoru` | `Studio Citadela, Klimentská 16, Praha 1 — suterénní scéna, kde hraje Kolekce Parchant.` |
| `fotky.astro` | `Fotky — Kolekce Parchant` | `Fotky` | `Fotografie z představení souboru Kolekce Parchant ve Studiu Citadela.` |

- [ ] **Step 8: Extend `EXPECTED_ROUTES` in `scripts/check.mjs`**

```js
const EXPECTED_ROUTES = [
  '/',
  '/program/',
  '/repertoar/',
  '/soubor/',
  '/o-nas/',
  '/o-prostoru/',
  '/fotky/',
].sort();
```

- [ ] **Step 9: Run `node scripts/check.mjs` — expect PASS** (7 routes × 2 widths, plus the reduced-motion visit). If the condense or trap checks fail, fix the layout, not the check.

- [ ] **Step 10: Commit**

```bash
git add src public/favicon.svg scripts/check.mjs
git commit -m "Base layout: KP mark, condensing masthead, burger overlay, footer, section stubs"
```

---

### Task 5: Content collections

**Files:**
- Create: `src/content.config.ts`, `src/content/people.json`, `src/content/productions/rychle-sipy-a-zahada-klubovny.json`, `src/content/productions/hra-lasky-a-nahody.json`

**Interfaces:**
- Produces: `getCollection('productions')` entries — `entry.id` is the slug (from the filename), `entry.data` matches the schema below. `getCollection('people')` entries — `entry.id` is the person slug, `entry.data = { name, role }`. Every person slug referenced anywhere in a production is validated against the people list **at build time** via `z.enum` — a removed or misspelled name fails the build, which is the whole point of the schema.

- [ ] **Step 1: Write `src/content/people.json`**

The eleven confirmed-so-far people. `id` is the slug (ASCII, diacritics stripped). Note the two Max* spellings are different people and must never be normalised to each other.

```json
[
  { "id": "prokop-zach", "name": "Prokop Zach", "role": "režie, scéna, hraje" },
  { "id": "zuzana-matuskova", "name": "Zuzana Matušková", "role": "hraje" },
  { "id": "ondrej-stupka", "name": "Ondřej Stupka", "role": "hraje" },
  { "id": "maximilian-dolansky", "name": "Maximilián Dolanský", "role": "hraje" },
  { "id": "maxmilian-kocek", "name": "Maxmilián Kocek", "role": "hraje" },
  { "id": "matous-vysata", "name": "Matouš Vyšata", "role": "alternace" },
  { "id": "aliska", "name": "Aliska", "role": "hraje" },
  { "id": "jiri-dlouhy", "name": "Jiří Dlouhý", "role": "hraje" },
  { "id": "simon-fikar", "name": "Šimon Fikar", "role": "alternace" },
  { "id": "simon-lorko", "name": "Šimon Lorko", "role": "text" },
  { "id": "marek-cimbal", "name": "Marek Cimbál", "role": "hudba" }
]
```

- [ ] **Step 2: Write `src/content.config.ts`**

```ts
// Content model. The dominant risk in this project has been content
// integrity: a name the client asked to remove reappearing, a corrected
// spelling reverting, a production crediting someone who does not exist.
// Every person reference is therefore validated against the people list at
// build time - z.enum over the actual slugs - so that class of error fails
// the build instead of shipping.
import { defineCollection } from 'astro:content';
import { glob, file } from 'astro/loaders';
import { z } from 'astro/zod';
import peopleData from './content/people.json';

const personSlug = z.enum(peopleData.map((person) => person.id) as [string, ...string[]]);

// One rendered line of a credits list. A part with a slug renders as a link
// to that person's page; a part without one is plain text (external names,
// "na motivy knih Jaroslava Foglara").
const creditRow = z.object({
  label: z.string(),
  parts: z.array(z.object({
    text: z.string(),
    slug: personSlug.optional(),
  })),
});

const productions = defineCollection({
  loader: glob({
    pattern: '*.json',
    base: './src/content/productions',
    // Entry IDs are the route slugs; make the derivation explicit rather than
    // trusting the default (which may transform the filename).
    generateId: ({ entry }) => entry.replace(/\.json$/, ''),
  }),
  schema: z.object({
    titleLead: z.string(),
    titleRest: z.string(),
    blurb: z.string(),
    annotation: z.string(),
    creditsBefore: z.array(creditRow),
    // Cast as alternation groups: [["a"], ["b", "c"]] renders as "A, B / C".
    // Slugs, not names - names come from the people collection, so the
    // cross-linking is never maintained by hand.
    cast: z.array(z.array(personSlug)),
    creditsAfter: z.array(creditRow),
    score: z.string(),
    // Quotations from real named people; text is verbatim and case-exact.
    quotes: z.array(z.object({
      text: z.string(),
      author: z.string(),
      rating: z.string(),
      date: z.string(),
    })),
    idivadlo: z.string().url(),
    photos: z.array(z.object({
      src: z.string(),
      alt: z.string(),
      width: z.number().int(),
      height: z.number().int(),
    })),
    order: z.number().int(),
  }),
});

const people = defineCollection({
  loader: file('./src/content/people.json'),
  schema: z.object({
    name: z.string(),
    role: z.string(),
  }),
});

export const collections = { productions, people };
```

- [ ] **Step 3: Write `src/content/productions/rychle-sipy-a-zahada-klubovny.json`**

Content verbatim from the approved scroll page; `v nové size` is the client's wording — do not correct it.

```json
{
  "titleLead": "Rychlé šípy",
  "titleRest": "a záhada klubovny",
  "blurb": "Záhada slavných Foglarových Rychlých šípů v nové size od designera Šimona Lorka.",
  "annotation": "Napínavá a hravá autorská inscenace plná humoru a dobrodružství, která přináší svěží pohled na legendární příběh a zároveň dokazuje, že hodnoty Rychlých šípů jsou nadčasové. Mirek Dušín, Jarka Metelka, Jindra Hojer, Červenáček a Rychlonožka se vracejí do své klubovny, ale čeká je šok – jejich útočiště je obsazené někým cizím. Kdo vetřelcem je? Jak se do klubovny dostal?",
  "creditsBefore": [
    { "label": "Napsal", "parts": [
      { "text": "Šimon Lorko", "slug": "simon-lorko" },
      { "text": "na motivy knih Jaroslava Foglara" }
    ] },
    { "label": "Režie a scéna", "parts": [{ "text": "Prokop Zach", "slug": "prokop-zach" }] },
    { "label": "Hudba", "parts": [{ "text": "Marek Cimbál", "slug": "marek-cimbal" }] }
  ],
  "cast": [
    ["prokop-zach"],
    ["maxmilian-kocek", "matous-vysata"],
    ["ondrej-stupka"],
    ["zuzana-matuskova"],
    ["maximilian-dolansky"]
  ],
  "creditsAfter": [
    { "label": "Archivní nahrávky", "parts": [{ "text": "Tomáš Turek" }, { "text": "Roman Zach" }] },
    { "label": "Premiéra", "parts": [{ "text": "30. 1. 2026" }] },
    { "label": "Délka", "parts": [{ "text": "1 h 15 min, bez přestávky" }] },
    { "label": "Přístupnost", "parts": [{ "text": "6+" }] }
  ],
  "score": "87 %",
  "quotes": [
    {
      "text": "Uvolněné představení, které mnohé přenese zpět do mladých let, nebo alespoň budou pociťovat silnou nostalgii. Děj byl volný, dialogy vtipné, kde se to hodilo. Vyvrcholení hry bylo velkým překvapením. …",
      "author": "Hessy",
      "rating": "90 %",
      "date": "20. 3. 2026"
    },
    {
      "text": "ÚŽASNÝ! … určitě doporučuji všem věkovým kategoriím.",
      "author": "Mariematenova",
      "rating": "100 %",
      "date": "20. 2. 2026"
    }
  ],
  "idivadlo": "https://www.i-divadlo.cz/divadlo/kolekce-parchant/rychle-sipy-a-zahada-klubovny",
  "photos": [
    { "src": "/assets/panels/sipy-1.png", "alt": "Dívka v kapuci se s leknutím dívá vzhůru, za ní se v klubovně tísní další čtyři postavy pod visícími petrolejkami.", "width": 900, "height": 863 },
    { "src": "/assets/panels/sipy-2.png", "alt": "Šest herců se sklání nad otevřeným komiksem, který drží uprostřed skupiny sedící na podlaze klubovny.", "width": 900, "height": 788 },
    { "src": "/assets/panels/sipy-3.png", "alt": "Skupina postav stojí v klubovně kolem sedící dívky, jedna z nich gestikuluje uprostřed pohybu.", "width": 900, "height": 750 }
  ],
  "order": 1
}
```

- [ ] **Step 4: Write `src/content/productions/hra-lasky-a-nahody.json`**

No photos: only the Rychlé šípy photographs are identifiable, and `hra.png` must not be attributed to this production. No quotes: there is one 90% rating with no review text, so a badge and nothing more.

```json
{
  "titleLead": "Hra lásky",
  "titleRest": "a náhody",
  "blurb": "Klasická francouzská komedie z roku 1730 od Marivauxe v novém českém designu od Kolekce Parchant.",
  "annotation": "Slavná komedie francouzského klasika. Ona předstírá, že je služka. On dělá, že je sluha. Oba chtějí „nenápadně“ zjistit, koho si mají vzít. Výsledek? Láska na první pohled mezi dvěma lidmi, kteří si myslí, že milují úplně někoho jiného. Zkrátka romantika, chaos a převleky. Ať žije láska! A záměny!",
  "creditsBefore": [
    { "label": "Autor", "parts": [{ "text": "Pierre de Marivaux" }] },
    { "label": "Režie", "parts": [{ "text": "Prokop Zach", "slug": "prokop-zach" }] },
    { "label": "Hudba", "parts": [{ "text": "Marek Cimbál", "slug": "marek-cimbal" }] }
  ],
  "cast": [
    ["aliska"],
    ["jiri-dlouhy", "simon-fikar"],
    ["ondrej-stupka"],
    ["zuzana-matuskova"],
    ["maximilian-dolansky"],
    ["prokop-zach"]
  ],
  "creditsAfter": [
    { "label": "Premiéra", "parts": [{ "text": "2. 5. 2025" }] }
  ],
  "score": "90 %",
  "quotes": [],
  "idivadlo": "https://www.i-divadlo.cz/divadlo/kolekce-parchant/hra-lasky-a-nahody",
  "photos": [],
  "order": 2
}
```

- [ ] **Step 5: Build to validate**

```bash
npm run build
```
Expected: build passes (the collections are defined and valid even though no page consumes them yet).

- [ ] **Step 6: Negative control — prove the schema bites**

Temporarily change `"prokop-zach"` in one cast group to `"mikulas-polak"` and run `npm run build`. Expected: **build FAILS** with a zod enum error. Revert, build again, confirm green. This is the guard that a name the client removed can never quietly return via data.

- [ ] **Step 7: Run `node scripts/check.mjs`** — still green (7 routes).

- [ ] **Step 8: Commit**

```bash
git add src/content.config.ts src/content
git commit -m "Content collections: two productions and eleven people, slug-validated"
```

---

### Task 6: Homepage

**Files:**
- Modify: `src/pages/index.astro` (replace placeholder body), `src/styles/global.css` (append `.button`), `scripts/check.mjs` (checks first)

**Interfaces:**
- Consumes: `Base` layout (Task 4), `getCollection('productions')` (Task 5), `data/program.json` (repo root, existing — shape `{ updated, note, dates: [] }`).
- Produces: `.button` class (cherry ground, cream text, ink border) used by later pages.

- [ ] **Step 1: Add the failing checks to `scripts/check.mjs`**

```js
onPage('/',
  'hero: name, empty claim slot, verbatim pitch, Program CTA, photo',
  `JSON.stringify({
    title: document.querySelector('.hero__title')?.textContent.trim(),
    claimIsPlaceholder: document.querySelector('.hero__claim')?.hasAttribute('data-placeholder') ?? false,
    claimIsEmpty: (document.querySelector('.hero__claim')?.textContent.trim().length ?? 1) === 0,
    pitch: document.querySelector('.hero__pitch')?.textContent.trim(),
    cta: document.querySelector('.hero a.button')?.getAttribute('href'),
    photo: Boolean(document.querySelector('.hero img[src*="/assets/panels/"]')),
  })`,
  (raw) => {
    const hero = JSON.parse(raw);
    if (hero.title !== 'Kolekce Parchant') return `hero title was ${JSON.stringify(hero.title)}`;
    if (!hero.claimIsPlaceholder) return 'claim slot is not marked data-placeholder';
    if (!hero.claimIsEmpty) return 'claim slot must stay empty until the client sends it';
    // Her verbatim copy, character-exact, including the missing comma.
    const pitch = 'Divadelní soubor, který se nebojí provokovat. Jsme tu abychom bourali hranice a vytvářeli nezapomenutelné zážitky!';
    if (hero.pitch !== pitch) return `pitch was ${JSON.stringify(hero.pitch)}`;
    if (hero.cta !== '/program/') return `CTA href was ${JSON.stringify(hero.cta)}`;
    if (!hero.photo) return 'hero photo is missing';
    return null;
  },
);

onPage('/',
  'next-performance strip shows its honest empty state below the hero',
  `(() => {
    const strip = document.querySelector('.next');
    const hero = document.querySelector('.hero');
    return JSON.stringify({
      exists: Boolean(strip),
      belowHero: strip && hero
        ? strip.getBoundingClientRect().top >= hero.getBoundingClientRect().top
        : false,
      emptyVisible: Boolean(strip?.querySelector('.next__empty')),
      mentionsGoOut: (strip?.textContent ?? '').includes('GoOut'),
      tickets: strip ? strip.querySelectorAll('.ticket').length : -1,
    });
  })()`,
  (raw) => {
    const s = JSON.parse(raw);
    if (!s.exists) return 'no .next strip';
    if (!s.belowHero) return 'the strip must sit below the first screen, not above it';
    if (!s.emptyVisible) return 'empty state missing — there are no dates, and that must be said honestly';
    if (!s.mentionsGoOut) return 'empty state should say where dates get announced';
    if (s.tickets !== 0) return `expected no tickets, got ${s.tickets}`;
    return null;
  },
);

onPage('/',
  'two production cards in order, linking to their pages',
  `JSON.stringify([...document.querySelectorAll('.production-card')]
     .map((card) => card.querySelector('a')?.getAttribute('href')))`,
  (raw) => {
    const expected = ['/repertoar/rychle-sipy-a-zahada-klubovny/', '/repertoar/hra-lasky-a-nahody/'];
    const actual = JSON.parse(raw);
    return JSON.stringify(actual) === JSON.stringify(expected) ? null : `got ${JSON.stringify(actual)}`;
  },
);

// Generic from here on: declared image intrinsics must match the real files.
// The scroll page shipped with all four images declaring wrong dimensions;
// this makes that class of error fail loudly on every page.
generic(
  'declared image dimensions match the files',
  `JSON.stringify([...document.querySelectorAll('img')]
     .filter((img) => img.complete)
     .map((img) => ({
       src: img.getAttribute('src'),
       attr: img.getAttribute('width') + 'x' + img.getAttribute('height'),
       real: img.naturalWidth + 'x' + img.naturalHeight,
     })))`,
  (raw) => {
    const images = JSON.parse(raw);
    const wrong = images.filter((img) => img.attr !== img.real);
    return wrong.length
      ? wrong.map((img) => `${img.src} declares ${img.attr}, file is ${img.real}`).join('; ')
      : null;
  },
);
```

- [ ] **Step 2: Run `node scripts/check.mjs` — expect FAIL** on the three new `/` checks.

- [ ] **Step 3: Append `.button` to `src/styles/global.css`**

```css
.button {
  display: inline-block;
  padding: 0.6rem 1.2rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.85rem;
  color: var(--cream);
  background: var(--cherry);
  border: 3px solid var(--ink);
  text-decoration: none;
}
```

- [ ] **Step 4: Replace the body of `src/pages/index.astro`**

Keep the frontmatter import of `Base` and the JSON-LD `head` slot from Task 4 exactly as they are; add the collection queries and replace the `<section class="page">` placeholder with the real homepage:

```astro
---
import { getCollection } from 'astro:content';
import Base from '../layouts/Base.astro';
import program from '../../data/program.json';

const productions = (await getCollection('productions'))
  .sort((a, b) => a.data.order - b.data.order);

const description = 'Kolekce Parchant je nezávislý divadelní soubor ze Studia Citadela v Praze. Rychlé šípy a záhada klubovny, Hra lásky a náhody.';
---
<Base title="Kolekce Parchant" description={description}>
  <!-- JSON-LD head slot: unchanged from Task 4 -->

  <section class="hero page">
    <div class="page__inner hero__grid">
      <div class="hero__copy">
        <p class="hero__eyebrow">Nezávislé divadlo &middot; Praha</p>
        <h1 class="display hero__title">Kolekce Parchant</h1>

        <!-- The short claim under the name is still pending from the client.
             Deliberately separate from the pitch below: the backlog lists them
             as two different items. Leave empty rather than inventing one. -->
        <p class="hero__claim" data-placeholder></p>

        <p class="hero__pitch">Divadelní soubor, který se nebojí provokovat. Jsme tu abychom bourali hranice a vytvářeli nezapomenutelné zážitky!</p>

        <p><a class="button" href="/program/">Program</a></p>
      </div>

      <img
        class="hero__photo"
        src="/assets/panels/hero.png"
        width="1400"
        height="1077"
        alt="Šest herců stojí vedle sebe v řadě v podkroví s lany a petrolejkou nad hlavou."
      />
    </div>
  </section>

  <section class="next page">
    <div class="page__inner">
      <h2 class="next__eyebrow">Nejbližší představení</h2>
      {program.dates.length === 0 ? (
        <!-- No upcoming dates is the normal launch state, said honestly. -->
        <div class="next__empty">
          <p>Zatím žádný vypsaný termín. Nové termíny vypisujeme na GoOut &mdash; jakmile se objeví tam, najdete je i tady.</p>
          <p><a class="link" href="https://goout.net/cs/kolekce-parchant/pzpmtpg/">Sledovat na GoOut</a></p>
        </div>
      ) : (
        program.dates.slice(0, 1).map((date) => (
          <article class="ticket">
            <p class="ticket__date display">{date.when}</p>
            <p>{date.title}</p>
            <p><a class="link" href={date.url}>Vstupenky</a></p>
          </article>
        ))
      )}
    </div>
  </section>

  <section class="teaser page">
    <div class="page__inner">
      <h2 class="display page-heading">Repertoár</h2>
      <div class="teaser__grid">
        {productions.map((production) => (
          <article class="production-card">
            {production.data.photos.length > 0 ? (
              <img
                src={production.data.photos[0].src}
                width={production.data.photos[0].width}
                height={production.data.photos[0].height}
                alt={production.data.photos[0].alt}
                loading="lazy"
              />
            ) : (
              <!-- No identifiable photo exists for this production; an olive
                   block is honest, a misattributed photo is not. -->
              <div class="production-card__blank" aria-hidden="true"></div>
            )}
            <h3 class="display production-card__title">
              {production.data.titleLead} <span>{production.data.titleRest}</span>
            </h3>
            <p><a class="link" href={`/repertoar/${production.id}/`}>Více o inscenaci</a></p>
          </article>
        ))}
      </div>
    </div>
  </section>
</Base>

<style>
  .hero { background: var(--lime); }

  .hero__grid { display: grid; gap: 2rem; }

  /* Phone-first: halves stack, name first. Side by side from tablet up. */
  @media (min-width: 48rem) {
    .hero__grid { grid-template-columns: 1fr 1fr; align-items: center; }
  }

  .hero__eyebrow {
    margin: 0 0 1.25rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.22em;
    font-size: 0.8rem;
  }

  .hero__title {
    margin: 0;
    font-size: clamp(3rem, 13vw, 6.5rem);
    color: var(--cherry);
  }

  .hero__claim:empty { display: none; }

  .hero__pitch {
    max-width: var(--measure);
    margin: 1.5rem 0;
    font-size: clamp(1.15rem, 1rem + 1vw, 1.5rem);
    font-weight: 600;
    text-wrap: pretty;
  }

  .hero__photo { display: block; border: 3px solid var(--ink); }

  .next__eyebrow {
    margin: 0 0 1rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    font-size: 0.8rem;
    color: var(--cherry);
  }

  .next__empty {
    max-width: var(--measure);
    padding: 1.5rem;
    border: 3px dashed var(--ink);
  }

  .next__empty p { margin: 0 0 0.75rem; }
  .next__empty p:last-child { margin-bottom: 0; }

  .teaser { background: var(--lime); }

  .teaser__grid { display: grid; gap: 1.5rem; }

  @media (min-width: 48rem) {
    .teaser__grid { grid-template-columns: 1fr 1fr; }
  }

  .production-card { padding: 1.25rem; background: var(--cream); border: 3px solid var(--ink); }

  .production-card img,
  .production-card__blank { display: block; width: 100%; border: 3px solid var(--ink); }

  .production-card__blank { aspect-ratio: 900 / 750; background: var(--olive); }

  .production-card__title { margin: 1rem 0 0.5rem; font-size: clamp(1.5rem, 6vw, 2.2rem); }

  .production-card__title span { display: block; font-size: 0.55em; color: var(--cherry); }
</style>
```

Note for the implementer: Astro does not allow HTML comments inside JSX-style expressions — where the snippets above show a comment inside `{… ? … : …}`, place the comment above the expression instead.

- [ ] **Step 5: Run `node scripts/check.mjs` — expect PASS.**

- [ ] **Step 6: Commit**

```bash
git add src scripts/check.mjs
git commit -m "Homepage: split hero, next-performance empty state, production cards"
```

---

### Task 7: Program page

**Files:**
- Modify: `src/pages/program.astro` (replace stub), `scripts/check.mjs` (checks first)

**Interfaces:**
- Consumes: `Base`, `data/program.json`. When dates exist they have the shape `{ when: string, title: string, url: string, state: "on_sale" | "sold_out" }` — the homepage strip (Task 6) and this page must agree on it; today `dates` is `[]` and the empty state is the normal launch state.

- [ ] **Step 1: Add the failing checks**

```js
onPage('/program/',
  'program shows its empty state while there are no dates',
  `JSON.stringify({
    heading: document.querySelector('.page-heading')?.textContent.trim(),
    emptyVisible: Boolean(document.querySelector('.program__empty')),
    mentionsGoOut: document.body.textContent.includes('GoOut'),
    goOutLink: Boolean(document.querySelector('a[href*="goout.net/cs/kolekce-parchant"]')),
    tickets: document.querySelectorAll('.ticket').length,
  })`,
  (raw) => {
    const p = JSON.parse(raw);
    if (p.heading !== 'Program') return `heading was ${JSON.stringify(p.heading)}`;
    if (!p.emptyVisible) return 'empty state is not visible';
    if (!p.mentionsGoOut || !p.goOutLink) return 'empty state must say where dates get announced and link there';
    if (p.tickets !== 0) return `expected no tickets, got ${p.tickets}`;
    return null;
  },
);
```

- [ ] **Step 2: Run the suite — expect FAIL** on the new check (the stub has no `.program__empty`).

- [ ] **Step 3: Replace `src/pages/program.astro`**

```astro
---
import Base from '../layouts/Base.astro';
import program from '../../data/program.json';
---
<Base title="Program — Kolekce Parchant" description="Termíny představení souboru Kolekce Parchant ve Studiu Citadela v Praze. Nové termíny vypisujeme na GoOut.">
  <section class="page">
    <div class="page__inner">
      <h1 class="display page-heading">Program</h1>

      {program.dates.length === 0 ? (
        <div class="program__empty">
          <p class="program__empty-title display">Zatím žádný vypsaný termín</p>
          <p>Nové termíny vypisujeme na GoOut. Jakmile se objeví tam, najdete je i tady.</p>
          <p><a class="link" href="https://goout.net/cs/kolekce-parchant/pzpmtpg/">Sledovat na GoOut</a></p>
        </div>
      ) : (
        <div class="program__list">
          {program.dates.map((date) => (
            <article class="ticket" data-state={date.state}>
              <p class="ticket__date display">{date.when}</p>
              <p>{date.title}</p>
              <p><a class="link" href={date.url}>Vstupenky na GoOut</a></p>
            </article>
          ))}
        </div>
      )}
    </div>
  </section>
</Base>

<style>
  .program__empty {
    max-width: var(--measure);
    padding: 2rem;
    border: 3px dashed var(--ink);
  }

  .program__empty p { margin: 0 0 1rem; }
  .program__empty p:last-child { margin-bottom: 0; }

  .program__empty-title {
    font-size: clamp(1.35rem, 5vw, 2rem);
    color: var(--cherry);
  }

  .program__list { display: grid; gap: 1rem; max-width: var(--measure); }

  .ticket { padding: 1.5rem; background: var(--cream); border: 3px solid var(--ink); }
  .ticket__date { font-size: 1.5rem; color: var(--cherry); margin: 0 0 0.35rem; }
  .ticket p { margin: 0 0 0.35rem; }
  .ticket[data-state="sold_out"] { opacity: 0.55; }
</style>
```

- [ ] **Step 4: Run `node scripts/check.mjs` — expect PASS.**

- [ ] **Step 5: Commit**

```bash
git add src/pages/program.astro scripts/check.mjs
git commit -m "Program page with honest empty state driven by data/program.json"
```

---

### Task 8: Repertoár — index and production pages

**Files:**
- Modify: `src/pages/repertoar/index.astro` (replace stub), `scripts/check.mjs` (checks + routes first)
- Create: `src/pages/repertoar/[slug].astro`

**Interfaces:**
- Consumes: `Base`, both collections. Cast and credit links point at `/soubor/<slug>/` — those routes land in Task 9. **This task's gate is therefore: everything green EXCEPT the dead-internal-links check on the three repertoár pages.** Those known failures are the failing tests Task 9 starts from; the dead-link check exempts nothing.
- Produces: production pages whose cast entries link to `/soubor/<slug>/`; alternation rendered as `Jméno / Jméno`.

- [ ] **Step 1: Extend `EXPECTED_ROUTES`** with:

```js
  '/repertoar/rychle-sipy-a-zahada-klubovny/',
  '/repertoar/hra-lasky-a-nahody/',
```

- [ ] **Step 2: Add the failing checks**

```js
onPage('/repertoar/',
  'both productions listed in order, blurbs verbatim',
  `JSON.stringify({
    slugs: [...document.querySelectorAll('[data-slug]')].map((el) => el.dataset.slug),
    hasClientWording: document.body.textContent.includes('v nové size'),
    detailLinks: [...document.querySelectorAll('[data-slug] a')].map((a) => a.getAttribute('href')),
  })`,
  (raw) => {
    const r = JSON.parse(raw);
    const expected = ['rychle-sipy-a-zahada-klubovny', 'hra-lasky-a-nahody'];
    if (JSON.stringify(r.slugs) !== JSON.stringify(expected)) return `slugs were ${JSON.stringify(r.slugs)}`;
    if (!r.hasClientWording) {
      return "the exact string 'v nové size' is missing — the client's own wording, never silently corrected";
    }
    const missing = expected.map((slug) => `/repertoar/${slug}/`)
      .filter((href) => !r.detailLinks.includes(href));
    return missing.length ? `no link to ${missing.join(', ')}` : null;
  },
);

onPage('/repertoar/rychle-sipy-a-zahada-klubovny/',
  'šípy page: verbatim quotes, score, alternation, credits, gallery',
  `JSON.stringify({
    quotes: [...document.querySelectorAll('.press blockquote p')].map((p) => p.textContent.trim()),
    footers: [...document.querySelectorAll('.press blockquote footer')].map((f) => f.textContent.trim()),
    score: document.querySelector('.press__score')?.textContent.trim(),
    castText: document.querySelector('.cast')?.textContent.replace(/\\s+/g, ' ').trim(),
    castLinks: [...document.querySelectorAll('.cast a')].map((a) => a.getAttribute('href')),
    foglar: document.body.textContent.includes('na motivy knih Jaroslava Foglara'),
    premiere: document.body.textContent.includes('30. 1. 2026'),
    blurb: document.body.textContent.includes('v nové size'),
    photos: document.querySelectorAll('.gallery img').length,
  })`,
  (raw) => {
    const r = JSON.parse(raw);
    if (r.quotes.length !== 2) return `expected 2 quotes, got ${r.quotes.length}`;
    // Quotations from real named people are verbatim and case-exact.
    if (!r.quotes[1].startsWith('ÚŽASNÝ!')) return "Mariematenova's ÚŽASNÝ! must stay in capitals";
    if (!r.quotes[1].includes('určitě doporučuji')) return 'quote text altered';
    if (!r.footers[0].includes('Hessy') || !r.footers[0].includes('90 %')) return `first quote footer was ${JSON.stringify(r.footers[0])}`;
    if (r.score !== '87 %') return `score was ${JSON.stringify(r.score)}`;
    if (!r.castText.includes('Maxmilián Kocek / Matouš Vyšata')) return 'alternation must render as "Maxmilián Kocek / Matouš Vyšata"';
    if (r.castLinks.length !== 6) return `expected 6 cast links, got ${r.castLinks.length}`;
    if (!r.castLinks.includes('/soubor/maxmilian-kocek/')) return 'cast links do not point at person pages';
    if (!r.foglar) return 'Foglar credit line missing';
    if (!r.premiere) return 'premiere date missing';
    if (!r.blurb) return 'blurb (with "v nové size") missing from the production page';
    if (r.photos !== 3) return `expected 3 gallery photos, got ${r.photos}`;
    return null;
  },
);

onPage('/repertoar/hra-lasky-a-nahody/',
  'hra page: badge only, zero quotes, Aliska in cast, no photos',
  `JSON.stringify({
    quotes: document.querySelectorAll('.press blockquote').length,
    score: document.querySelector('.press__score')?.textContent.trim(),
    aliska: [...document.querySelectorAll('.cast a')].some((a) => a.getAttribute('href') === '/soubor/aliska/'),
    photos: document.querySelectorAll('.gallery img').length,
    idivadlo: Boolean(document.querySelector('a[href*="i-divadlo.cz/divadlo/kolekce-parchant/hra-lasky-a-nahody"]')),
  })`,
  (raw) => {
    const r = JSON.parse(raw);
    if (r.quotes !== 0) return 'Hra lásky has no review text, so it must show no quote';
    if (r.score !== '90 %') return `score was ${JSON.stringify(r.score)}`;
    if (!r.aliska) return 'Aliska missing from cast links';
    if (r.photos !== 0) return "no identifiable photos exist for this production — showing any misattributes someone's work";
    if (!r.idivadlo) return 'i-divadlo source link missing';
    return null;
  },
);
```

- [ ] **Step 3: Run the suite — expect FAIL** (missing routes, then missing content).

- [ ] **Step 4: Replace `src/pages/repertoar/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';

const productions = (await getCollection('productions'))
  .sort((a, b) => a.data.order - b.data.order);
---
<Base title="Repertoár — Kolekce Parchant" description="Inscenace souboru Kolekce Parchant: Rychlé šípy a záhada klubovny, Hra lásky a náhody.">
  <section class="page repertoar">
    <div class="page__inner">
      <h1 class="display page-heading">Repertoár</h1>

      {productions.map((production) => (
        <article class="production" data-slug={production.id}>
          <h2 class="display production__title">
            <a href={`/repertoar/${production.id}/`}>
              {production.data.titleLead}
              <span class="production__title-rest">{production.data.titleRest}</span>
            </a>
          </h2>
          <p class="production__blurb">{production.data.blurb}</p>
          <p><a class="link" href={`/repertoar/${production.id}/`}>Více o inscenaci</a></p>
        </article>
      ))}
    </div>
  </section>
</Base>

<style>
  .repertoar { background: var(--lime); }

  .production {
    padding-block: clamp(2rem, 6vw, 3rem);
    border-top: 3px solid var(--ink);
  }

  .production:first-of-type { border-top: 0; padding-top: 0; }

  .production__title { margin: 0 0 1rem; font-size: clamp(2.2rem, 10vw, 4rem); }

  .production__title a { color: var(--ink); text-decoration: none; }

  .production__title-rest { display: block; font-size: 0.5em; color: var(--cherry); }

  .production__blurb {
    max-width: var(--measure);
    font-size: clamp(1.05rem, 1rem + 0.5vw, 1.3rem);
    font-weight: 600;
    margin: 0 0 1rem;
  }
</style>
```

- [ ] **Step 5: Create `src/pages/repertoar/[slug].astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';

export async function getStaticPaths() {
  const productions = await getCollection('productions');
  return productions.map((production) => ({
    params: { slug: production.id },
    props: { production },
  }));
}

const { production } = Astro.props;
const data = production.data;

// Names come from the people collection; data holds only slugs, so a renamed
// person changes everywhere at once.
const people = await getCollection('people');
const nameOf = new Map(people.map((person) => [person.id, person.data.name]));

const title = `${data.titleLead} ${data.titleRest} — Kolekce Parchant`;
---
<Base title={title} description={data.blurb}>
  <article class="page">
    <div class="page__inner">
      <h1 class="display page-heading production__title">
        {data.titleLead}
        <span class="production__title-rest">{data.titleRest}</span>
      </h1>

      <p class="production__blurb">{data.blurb}</p>

      <p class="prose production__annotation">{data.annotation}</p>

      <dl class="credits">
        {data.creditsBefore.map((row) => (
          <>
            <dt>{row.label}</dt>
            <dd>
              {row.parts.map((part, index) => (
                <>
                  {index > 0 && ', '}
                  {part.slug
                    ? <a class="link" href={`/soubor/${part.slug}/`}>{part.text}</a>
                    : part.text}
                </>
              ))}
            </dd>
          </>
        ))}

        <dt>Hrají</dt>
        <dd class="cast">
          {data.cast.map((group, groupIndex) => (
            <>
              {groupIndex > 0 && ', '}
              {group.map((slug, slugIndex) => (
                <>
                  {slugIndex > 0 && ' / '}
                  <a class="link" href={`/soubor/${slug}/`}>{nameOf.get(slug)}</a>
                </>
              ))}
            </>
          ))}
        </dd>

        {data.creditsAfter.map((row) => (
          <>
            <dt>{row.label}</dt>
            <dd>
              {row.parts.map((part, index) => (
                <>
                  {index > 0 && ', '}
                  {part.slug
                    ? <a class="link" href={`/soubor/${part.slug}/`}>{part.text}</a>
                    : part.text}
                </>
              ))}
            </dd>
          </>
        ))}
      </dl>

      <div class="press">
        <p class="press__score display">{data.score}</p>
        {data.quotes.map((quote) => (
          <blockquote>
            <p>{quote.text}</p>
            <footer>{quote.author} &middot; {quote.rating} &middot; {quote.date}</footer>
          </blockquote>
        ))}
        <p class="press__source">
          Hodnocení diváků na <a class="link" href={data.idivadlo}>i-divadlo.cz</a>
        </p>
      </div>

      {data.photos.length > 0 && (
        <div class="gallery">
          {data.photos.map((photo) => (
            <figure class="gallery__item">
              <img src={photo.src} width={photo.width} height={photo.height} alt={photo.alt} loading="lazy" />
            </figure>
          ))}
        </div>
      )}
    </div>
  </article>
</Base>

<style>
  .production__title { font-size: clamp(2.4rem, 11vw, 4.5rem); color: var(--ink); }

  .production__title-rest { display: block; font-size: 0.5em; color: var(--cherry); }

  .production__blurb {
    max-width: var(--measure);
    font-size: clamp(1.05rem, 1rem + 0.5vw, 1.3rem);
    font-weight: 600;
  }

  .press {
    margin-top: 2.5rem;
    padding: 1.5rem;
    background: var(--cream);
    border: 3px solid var(--ink);
    max-width: var(--measure);
  }

  .press__score { margin: 0 0 1rem; font-size: clamp(2rem, 8vw, 3rem); color: var(--cherry); }

  .press blockquote { margin: 0 0 1.25rem; padding-left: 1rem; border-left: 3px solid var(--cherry); }

  .press blockquote p { margin: 0 0 0.5rem; font-style: italic; text-wrap: pretty; }

  .press blockquote footer {
    font-size: 0.78rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .press__source { margin: 0; font-size: 0.82rem; }

  .gallery { display: grid; gap: 1rem; margin-top: 2.5rem; }

  @media (min-width: 48rem) { .gallery { grid-template-columns: 1fr 1fr; } }

  .gallery__item { margin: 0; }

  .gallery__item img { display: block; width: 100%; border: 3px solid var(--ink); }
</style>
```

- [ ] **Step 6: Run the suite.** Expected: everything passes EXCEPT *"every internal link resolves"* on the three repertoár pages — the `/soubor/<slug>/` targets do not exist yet. Confirm those are the only failures. They are Task 9's starting point.

- [ ] **Step 7: Commit**

```bash
git add src/pages/repertoar scripts/check.mjs
git commit -m "Repertoar index and production pages from the collections"
```

---

### Task 9: Soubor — ensemble index and person pages

**Files:**
- Modify: `src/pages/soubor/index.astro` (replace stub), `scripts/check.mjs` (checks + routes first)
- Create: `src/pages/soubor/[slug].astro`

**Interfaces:**
- Consumes: both collections. A person's productions = every production whose `cast` (flattened) or credit `parts[].slug` contains their id. This is the cross-linking the spec wants falling out of the data, in both directions, maintained by hand in neither.

- [ ] **Step 1: Extend `EXPECTED_ROUTES`** with the eleven person routes:

```js
  '/soubor/prokop-zach/', '/soubor/zuzana-matuskova/', '/soubor/ondrej-stupka/',
  '/soubor/maximilian-dolansky/', '/soubor/maxmilian-kocek/', '/soubor/matous-vysata/',
  '/soubor/aliska/', '/soubor/jiri-dlouhy/', '/soubor/simon-fikar/',
  '/soubor/simon-lorko/', '/soubor/marek-cimbal/',
```

- [ ] **Step 2: Add the failing checks**

```js
onPage('/soubor/',
  'ensemble lists all eleven people, each linking to their page',
  `JSON.stringify([...document.querySelectorAll('.ensemble a')]
     .map((a) => a.getAttribute('href')))`,
  (raw) => {
    const links = JSON.parse(raw);
    if (links.length !== 11) return `expected 11 person links, got ${links.length}`;
    for (const slug of ['prokop-zach', 'aliska', 'maxmilian-kocek', 'maximilian-dolansky', 'matous-vysata']) {
      if (!links.includes(`/soubor/${slug}/`)) return `missing link to /soubor/${slug}/`;
    }
    return null;
  },
);

onPage('/soubor/prokop-zach/',
  'person page cross-links to every production they are in',
  `JSON.stringify([...document.querySelectorAll('.person__productions a')]
     .map((a) => a.getAttribute('href')))`,
  (raw) => {
    const links = JSON.parse(raw);
    const expected = ['/repertoar/rychle-sipy-a-zahada-klubovny/', '/repertoar/hra-lasky-a-nahody/'];
    const missing = expected.filter((href) => !links.includes(href));
    return missing.length ? `missing: ${missing.join(', ')}` : null;
  },
);

onPage('/soubor/simon-lorko/',
  'creative credits count as involvement, not just cast',
  `JSON.stringify([...document.querySelectorAll('.person__productions a')]
     .map((a) => a.getAttribute('href')))`,
  (raw) => {
    // Šimon Lorko wrote šípy but is in neither cast; if his page shows no
    // productions, credits are not being queried.
    const links = JSON.parse(raw);
    return links.includes('/repertoar/rychle-sipy-a-zahada-klubovny/')
      ? null
      : "Šimon Lorko's page must list Rychlé šípy via his writing credit";
  },
);

onPage('/soubor/aliska/',
  'Aliska is billed under the name the client asked for',
  `JSON.stringify({
    heading: document.querySelector('h1')?.textContent.trim(),
    hra: [...document.querySelectorAll('.person__productions a')]
      .some((a) => a.getAttribute('href') === '/repertoar/hra-lasky-a-nahody/'),
  })`,
  (raw) => {
    const r = JSON.parse(raw);
    if (r.heading !== 'Aliska') return `heading was ${JSON.stringify(r.heading)} — her full billing name is still unconfirmed, use "Aliska"`;
    if (!r.hra) return 'Hra lásky missing from her productions';
    return null;
  },
);
```

- [ ] **Step 3: Run the suite — expect FAIL** (route set mismatch first).

- [ ] **Step 4: Replace `src/pages/soubor/index.astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';

// Collection order follows the JSON file, which is the approved billing order.
const people = await getCollection('people');
---
<Base title="Soubor — Kolekce Parchant" description="Lidé souboru Kolekce Parchant — herci a tvůrci nezávislého divadla ze Studia Citadela.">
  <section class="page">
    <div class="page__inner">
      <h1 class="display page-heading">Soubor</h1>

      <!-- Compiled from the two productions' credits on i-divadlo, with the
           client's corrections applied (Aliska; Maxmilián Kocek; Matouš
           Vyšata; Mikuláš Polák removed). Still not the company's own list -
           confirm before launch. -->
      <ul class="ensemble">
        {people.map((person) => (
          <li class="ensemble__person">
            <a class="ensemble__link" href={`/soubor/${person.id}/`}>
              <span class="ensemble__name display">{person.data.name}</span>
              <span class="ensemble__role">{person.data.role}</span>
            </a>
          </li>
        ))}
      </ul>

      <p class="ensemble__note">Archivní nahrávky &middot; Tomáš Turek, Roman Zach</p>
    </div>
  </section>
</Base>

<style>
  .ensemble {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(11rem, 1fr));
    gap: 0.75rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ensemble__person { background: var(--lime); border: 3px solid var(--ink); }

  .ensemble__link { display: grid; gap: 0.15rem; padding: 1rem; text-decoration: none; color: var(--ink); }

  .ensemble__link:hover .ensemble__name,
  .ensemble__link:focus-visible .ensemble__name { color: var(--cherry); }

  .ensemble__name { font-size: 1.15rem; line-height: 1.15; }

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
</style>
```

- [ ] **Step 5: Create `src/pages/soubor/[slug].astro`**

```astro
---
import { getCollection } from 'astro:content';
import Base from '../../layouts/Base.astro';

export async function getStaticPaths() {
  const people = await getCollection('people');
  return people.map((person) => ({
    params: { slug: person.id },
    props: { person },
  }));
}

const { person } = Astro.props;

// Involvement is queried, not maintained: cast groups plus any credit row
// that names this person. Both directions of the cross-linking fall out of
// the production data.
const productions = (await getCollection('productions'))
  .filter((production) =>
    production.data.cast.flat().includes(person.id)
    || [...production.data.creditsBefore, ...production.data.creditsAfter]
      .some((row) => row.parts.some((part) => part.slug === person.id)))
  .sort((a, b) => a.data.order - b.data.order);

const title = `${person.data.name} — Kolekce Parchant`;
const description = `${person.data.name} (${person.data.role}) — Kolekce Parchant, nezávislý divadelní soubor ze Studia Citadela v Praze.`;
---
<Base title={title} description={description}>
  <article class="page">
    <div class="page__inner">
      <h1 class="display page-heading">{person.data.name}</h1>
      <p class="person__role">{person.data.role}</p>

      <h2 class="person__subheading">V inscenacích</h2>
      <ul class="person__productions">
        {productions.map((production) => (
          <li>
            <a class="link" href={`/repertoar/${production.id}/`}>
              {production.data.titleLead} {production.data.titleRest}
            </a>
          </li>
        ))}
      </ul>

      <p><a class="link" href="/soubor/">Zpět na soubor</a></p>
    </div>
  </article>
</Base>

<style>
  .person__role {
    margin: 0 0 2rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-size: 0.85rem;
  }

  .person__subheading {
    margin: 0 0 0.75rem;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: var(--cherry);
  }

  .person__productions {
    margin: 0 0 2rem;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 0.5rem;
  }
</style>
```

- [ ] **Step 6: Run `node scripts/check.mjs` — expect FULL PASS**, including the dead-link failures left open at the end of Task 8 (cast links now resolve).

- [ ] **Step 7: Commit**

```bash
git add src/pages/soubor scripts/check.mjs
git commit -m "Soubor index and person pages with queried cross-links"
```

---

### Task 10: O nás, O prostoru, Fotky, 404

**Files:**
- Modify: `src/pages/o-nas.astro`, `src/pages/o-prostoru.astro`, `src/pages/fotky.astro` (replace stubs), `scripts/check.mjs` (checks + routes first)
- Create: `src/pages/404.astro`

**Interfaces:**
- Consumes: `Base`, `.credits` and `.prose` classes from Task 4.
- Produces: the complete route set — after this task `EXPECTED_ROUTES` is final.

- [ ] **Step 1: Extend `EXPECTED_ROUTES`** with `'/404.html'` (the section routes are already present from Task 4).

- [ ] **Step 2: Add the failing checks**

```js
onPage('/o-nas/',
  'O nás holds marked placeholder prose, nothing invented',
  `JSON.stringify({
    placeholder: Boolean(document.querySelector('[data-placeholder]')),
    mentionsPending: document.querySelector('[data-placeholder]')?.textContent.includes('drží místo') ?? false,
  })`,
  (raw) => {
    const r = JSON.parse(raw);
    if (!r.placeholder) return 'O nás prose is still pending from the client and must be marked data-placeholder';
    if (!r.mentionsPending) return 'placeholder text must say it is holding space, so nobody mistakes it for real copy';
    return null;
  },
);

onPage('/o-prostoru/',
  'venue page carries the address and the trams',
  `JSON.stringify({
    address: document.body.textContent.includes('Klimentská 16'),
    trams: document.body.textContent.includes('Dlouhá třída'),
  })`,
  (raw) => {
    const r = JSON.parse(raw);
    if (!r.address) return 'address missing';
    if (!r.trams) return 'tram stop missing';
    return null;
  },
);

onPage('/fotky/',
  'gallery: four photos, honest captions, one animation hook',
  `JSON.stringify({
    captions: [...document.querySelectorAll('.gallery__item figcaption')].map((c) => c.textContent.trim()),
    animateHooks: document.querySelectorAll('[data-animate]').length,
    altsDistinct: new Set([...document.querySelectorAll('.gallery__item img')].map((img) => img.alt)).size,
  })`,
  (raw) => {
    const g = JSON.parse(raw);
    const expected = [
      'Rychlé šípy a záhada klubovny', 'Rychlé šípy a záhada klubovny',
      'Rychlé šípy a záhada klubovny', 'Soubor',
    ];
    if (JSON.stringify(g.captions) !== JSON.stringify(expected)) {
      return `captions were ${JSON.stringify(g.captions)} — only šípy photos are identifiable; nothing else may carry a production name`;
    }
    if (g.animateHooks !== 1) return `expected exactly one data-animate hook, got ${g.animateHooks}`;
    if (g.altsDistinct !== 4) return 'alt texts must describe each photo, not duplicate the captions';
    return null;
  },
);

onPage('/404.html',
  '404 page says so and links home',
  `JSON.stringify({
    saysNotFound: document.body.textContent.includes('Stránka nenalezena'),
    homeLink: Boolean(document.querySelector('main a[href="/"]')),
  })`,
  (raw) => {
    const r = JSON.parse(raw);
    if (!r.saysNotFound) return 'no not-found message';
    if (!r.homeLink) return 'no link home';
    return null;
  },
);
```

- [ ] **Step 3: Run the suite — expect FAIL** (route set: missing `/404.html`; then the content checks).

- [ ] **Step 4: Replace `src/pages/o-nas.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="O nás — Kolekce Parchant" description="Kolekce Parchant je nezávislý divadelní soubor, který hraje ve Studiu Citadela v Praze.">
  <section class="page o-nas">
    <div class="page__inner">
      <h1 class="display page-heading">O nás</h1>

      <!-- Her own text is still pending. This holds the space so the layout
           can be judged; replace it wholesale, do not edit around it. -->
      <div class="prose" data-placeholder>
        <p>
          Sem patří text o souboru &mdash; kdo jste, jak jste začali, proč
          Parchant. Zatím drží místo, aby bylo vidět, kolik ho na stránce je.
        </p>
      </div>
    </div>
  </section>
</Base>

<style>
  .o-nas { background: var(--olive); }
</style>
```

- [ ] **Step 5: Replace `src/pages/o-prostoru.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="O prostoru — Kolekce Parchant" description="Studio Citadela, Klimentská 16, Praha 1 — suterénní scéna, kde hraje Kolekce Parchant.">
  <section class="page">
    <div class="page__inner">
      <h1 class="display page-heading">O prostoru</h1>

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
</Base>
```

- [ ] **Step 6: Replace `src/pages/fotky.astro`**

```astro
---
import Base from '../layouts/Base.astro';

// Only the Rychlé šípy photographs are identifiable. Nothing else may be
// captioned with a production name; misattributing someone else's production
// is worse than an uncaptioned photo. hero.png is the company itself.
const photos = [
  { src: '/assets/panels/sipy-1.png', width: 900, height: 863, caption: 'Rychlé šípy a záhada klubovny', animate: true,
    alt: 'Dívka v kapuci se s leknutím dívá vzhůru, za ní se v klubovně tísní další čtyři postavy pod visícími petrolejkami.' },
  { src: '/assets/panels/sipy-2.png', width: 900, height: 788, caption: 'Rychlé šípy a záhada klubovny', animate: false,
    alt: 'Šest herců se sklání nad otevřeným komiksem, který drží uprostřed skupiny sedící na podlaze klubovny.' },
  { src: '/assets/panels/sipy-3.png', width: 900, height: 750, caption: 'Rychlé šípy a záhada klubovny', animate: false,
    alt: 'Skupina postav stojí v klubovně kolem sedící dívky, jedna z nich gestikuluje uprostřed pohybu.' },
  { src: '/assets/panels/hero.png', width: 1400, height: 1077, caption: 'Soubor', animate: false,
    alt: 'Šest herců stojí vedle sebe v řadě v podkroví s lany a petrolejkou nad hlavou.' },
];
---
<Base title="Fotky — Kolekce Parchant" description="Fotografie z představení souboru Kolekce Parchant ve Studiu Citadela.">
  <section class="page fotky">
    <div class="page__inner">
      <h1 class="display page-heading">Fotky</h1>

      <div class="gallery">
        {photos.map((photo) => (
          <figure class="gallery__item" data-animate={photo.animate ? 'hero' : undefined}>
            <img src={photo.src} width={photo.width} height={photo.height} alt={photo.alt} loading="lazy" />
            <figcaption>{photo.caption}</figcaption>
          </figure>
        ))}
      </div>
    </div>
  </section>
</Base>

<style>
  .fotky { background: var(--lime); }

  .gallery { display: grid; gap: 1.5rem; }

  @media (min-width: 48rem) { .gallery { grid-template-columns: 1fr 1fr; } }

  .gallery__item { margin: 0; }

  .gallery__item img { display: block; width: 100%; border: 3px solid var(--ink); }

  .gallery__item figcaption {
    margin-top: 0.5rem;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
</style>
```

- [ ] **Step 7: Create `src/pages/404.astro`**

```astro
---
import Base from '../layouts/Base.astro';
---
<Base title="Stránka nenalezena — Kolekce Parchant" description="Tahle stránka u nás není. Zkuste to znovu z úvodní stránky souboru Kolekce Parchant.">
  <section class="page">
    <div class="page__inner">
      <h1 class="display page-heading">Stránka nenalezena</h1>
      <p class="prose">Tahle stránka u nás není. Divadlo ale ano.</p>
      <p><a class="button" href="/">Na úvodní stránku</a></p>
    </div>
  </section>
</Base>
```

- [ ] **Step 8: Run `node scripts/check.mjs` — expect FULL PASS**: 21 routes × 2 widths plus the reduced-motion visit.

- [ ] **Step 9: Commit**

```bash
git add src/pages scripts/check.mjs
git commit -m "O nas, O prostoru, Fotky and 404 pages; route set complete"
```

---

### Task 11: Publish gate and README

**Files:**
- Modify: `scripts/publish-docs.sh`, `README.md`
- Modify (result of running the script): `docs/`

**Interfaces:**
- Consumes: `scripts/check.mjs` (which builds `dist/` itself).
- Produces: `docs/` = the checked build plus `.nojekyll` and a disallow-all `robots.txt`. The superseded prototype pages leave `docs/` but remain in git under `prototype/`.

- [ ] **Step 1: Replace `scripts/publish-docs.sh`**

```bash
#!/usr/bin/env bash
# Assemble docs/ for publishing.
# Pages serves from main:/docs, so docs/ is committed while dist/ stays ignored.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# check.mjs runs the build itself, so it can never approve a stale dist/.
# Fail rather than publish a site that does not pass its own checks.
node scripts/check.mjs

rm -rf docs
cp -R dist docs

# Skip Jekyll: plain files, and it would eat the underscore-prefixed _astro/.
touch docs/.nojekyll

# A site carrying unverified cast names does not belong in a search index.
cat > docs/robots.txt <<'EOF'
User-agent: *
Disallow: /
EOF

echo "docs/ assembled:"
find docs -type f | sort
```

Note what this drops on purpose: the old `docs/index.html` (poster-press scroll page) and `docs/canvas.html` (canvas comparison). Both directions are superseded; their sources stay in git under `prototype/`.

- [ ] **Step 2: Run it**

```bash
bash scripts/publish-docs.sh
```
Expected: full check suite green, then a `docs/` listing containing `index.html`, the section directories, `404.html`, `_astro/`, `fonts/`, `assets/panels/`, `favicon.svg`, `.nojekyll`, `robots.txt`.

- [ ] **Step 3: Spot-check the published copy**

```bash
node scripts/serve.mjs docs 4700 &
curl -s http://127.0.0.1:4700/repertoar/rychle-sipy-a-zahada-klubovny/ | grep -c "v nové size"
kill %1
```
Expected: `1`.

- [ ] **Step 4: Update `README.md`**

Read the current README first. Replace its architecture/commands description (the parts describing the prototype single-page workflow) with the multi-page workflow, keeping the project background sections intact. The new commands section:

```markdown
## How this is built

Astro static site. Content lives in schema-validated collections
(`src/content/`): two productions and eleven people, with every person
reference checked against the people list at build time.

    npm install            # once
    npm run dev            # live dev server
    node scripts/check.mjs # build + full check suite (needs Brave installed)
    node scripts/serve.mjs # preview dist/ at http://127.0.0.1:4173/
    bash scripts/publish-docs.sh  # checks, then assembles docs/

Links are root-relative, so the built site is previewed over HTTP, not
file://. The previous single-page prototype is kept as-is in `prototype/`.
```

- [ ] **Step 5: Final full run and commit**

```bash
node scripts/check.mjs
git add scripts/publish-docs.sh README.md docs
git commit -m "Publish gate builds and checks the Astro site into docs/"
```

---

## Deliberately out of scope

- **Hosting / DNS for kolekceparchant.cz** — separate decision after client sign-off.
- **The seven client-blocked items** (claim, O nás prose, cast confirmation incl. Aliska's billing name, `v nové size` wording, October premiere, Facebook, GoOut dates) — the site is built so each lands as a data or one-file edit.
- **The "actors moving" animation** — the `data-animate="hero"` hook is preserved on `/fotky/`; the animation itself needs a non-OpenRouter provider and a separate decision.
- **Regenerating gallery panels (~$0.55)** — user's spend decision; `public/assets/panels/` is a copy of the approved set.
- **Removing `prototype/`** — kept untouched.





