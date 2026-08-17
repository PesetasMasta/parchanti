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
  '/program/',
  '/repertoar/',
  '/soubor/',
  '/o-nas/',
  '/o-prostoru/',
  '/fotky/',
  '/repertoar/rychle-sipy-a-zahada-klubovny/',
  '/repertoar/hra-lasky-a-nahody/',
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

  // The condense transition must be suppressed under prefers-reduced-motion:
  // it snaps instead of animating. Separate visit: media emulation is
  // per-navigation, so this cannot ride inside the main loop. Runs while the
  // static server is still up, so it lives inside this try before the
  // finally below closes it.
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
} finally {
  server.close();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nall checks passed: ${EXPECTED_ROUTES.length} routes x ${widths.length} widths`);
