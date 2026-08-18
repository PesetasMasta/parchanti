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
import { readdirSync, statSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { staticServer } from './serve.mjs';
import { withBrowser } from './lib/browser.mjs';

const DIST = new URL('../dist', import.meta.url).pathname;
const PORT = 4517;

// The program assertions compare the rendered page against the same file the
// pages render from, so adding a date cannot silently go unchecked.
const program = JSON.parse(readFileSync(new URL('../data/program.json', import.meta.url), 'utf8'));

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
  '/soubor/prokop-zach/', '/soubor/zuzana-matuskova/', '/soubor/ondrej-stupka/',
  '/soubor/maximilian-dolansky/', '/soubor/maxmilian-kocek/', '/soubor/matous-vysata/',
  '/soubor/aliska/', '/soubor/jiri-dlouhy/', '/soubor/simon-fikar/',
  '/soubor/simon-lorko/', '/soubor/marek-cimbal/',
  '/404.html',
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
    // If the face lacks a glyph the browser substitutes silently. Measuring
    // the face against a family that cannot exist catches that: when both
    // render from the same system fallback the widths are identical.
    // Comparing against a named fallback instead (', monospace') does NOT
    // work - an absent glyph resolves through the system fallback, not
    // through the listed family, so the widths differ and a face with no
    // Czech at all passes. Rye passed that way on 2026-08-18 while missing
    // eight letters. Per character, so the report names them.
    // document.fonts.load() forces the fetch first - without it this
    // measurement races the async @font-face load.
    const result = {};
    for (const family of ['"Ultra"', '"Archivo"']) {
      await document.fonts.load('64px ' + family, 'ěščřžůťďňĚŠČŘŽŮŤĎŇ');
      const missing = [...'ěščřžůťďňĚŠČŘŽŮŤĎŇ'].filter((character) =>
        widthOf(character, family) === widthOf(character, '"NoSuchFamily12345"'));
      result[family] = missing;
    }
    probe.remove();
    return JSON.stringify(result);
  })()`,
  (raw) => {
    const result = JSON.parse(raw);
    const broken = Object.entries(result).filter(([, missing]) => missing.length);
    return broken.length
      ? broken.map(([family, missing]) => `${family} lacks ${missing.join(' ')}`).join('; ')
      : null;
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

// Matched case-insensitively: the client writes her own productions in capitals
// ("ČERVÁNKY"), so a case-sensitive needle would let the very spelling we are
// guarding against walk straight through.
// 'červánky' was removed from this list on 2026-08-17: the premiere was blocked
// because she had never mentioned it, and she has now scheduled it herself.
// Hančilová stays out — her name is not needed to list a date, and it is still
// unverified.
generic(
  'no forbidden name appears',
  `JSON.stringify(['Pivařská', 'Aneta Kalertová', 'Mikuláš Polák', 'Višata', 'Hančilová']
     .filter((needle) => document.documentElement.textContent.toLowerCase().includes(needle.toLowerCase())))`,
  (raw) => {
    const found = JSON.parse(raw);
    return found.length
      ? `forbidden on this page: ${found.join(', ')} — removed names must stay removed`
      : null;
  },
);

// The ticket cards render a link only when a date carries a ticket URL. An
// anchor with no href looks like a link, is not one, and is invisible to the
// internal-link check because it has no path to resolve.
generic(
  'no anchor is rendered without a destination',
  `JSON.stringify([...document.querySelectorAll('a')]
     .filter((a) => !a.getAttribute('href')?.trim())
     .map((a) => a.textContent.trim().slice(0, 40)))`,
  (raw) => {
    const dead = JSON.parse(raw);
    return dead.length ? `link-styled elements with no href: ${dead.join(', ')}` : null;
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
    // Hidden by display, by opacity or by visibility - which one is an
    // implementation detail, and it differs between the scroll-driven path
    // and its stepped fallback.
    const hidden = (el) => {
      const style = getComputedStyle(el);
      return style.display === 'none'
        || style.visibility === 'hidden'
        || parseFloat(style.opacity) === 0;
    };
    // The page may be short while under construction; the behaviour under
    // test is scroll-driven, so guarantee there is somewhere to scroll to.
    document.body.style.minHeight = '300vh';
    window.scrollTo(0, 0);
    await frame(); await frame();
    const fullHeight = masthead.getBoundingClientRect().height;
    const nameVisibleAtTop = !hidden(name);
    window.scrollTo(0, 600);
    await frame(); await frame(); await new Promise((resolve) => setTimeout(resolve, 350));
    const condensedHeight = masthead.getBoundingClientRect().height;
    const nameHiddenAfterScroll = hidden(name);
    const scrollPaddingTop = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    const burger = document.querySelector('.burger');
    const burgerBox = burger.getBoundingClientRect();
    const burgerCondensed = {
      width: burgerBox.width,
      height: burgerBox.height,
      labelHidden: hidden(document.querySelector('.burger__label')),
      barsVisible: getComputedStyle(document.querySelector('.burger__bars')).display !== 'none',
      name: burger.getAttribute('aria-label') ?? burger.textContent.trim(),
    };
    window.scrollTo(0, 0);
    document.body.style.minHeight = '';
    return JSON.stringify({ fullHeight, nameVisibleAtTop, condensedHeight, nameHiddenAfterScroll, scrollPaddingTop, burgerCondensed });
  })()`,
  (raw) => {
    const s = JSON.parse(raw);
    if (!s.nameVisibleAtTop) return 'the full lockup name is not visible at the top';
    if (!s.nameHiddenAfterScroll) return 'the name did not drop away when condensed';
    if (s.condensedHeight >= s.fullHeight) return `condensed ${s.condensedHeight}px is not smaller than full ${s.fullHeight}px`;
    // Condensed, the button keeps only its bars. Shrinking a control is easy
    // to overdo, so the tap target and the accessible name are asserted here
    // rather than left to the eye.
    const b = s.burgerCondensed;
    if (!b.labelHidden) return 'the burger still shows its label when condensed';
    if (!b.barsVisible) return 'the burger bars vanished — the button is now unlabelled and unreadable';
    if (!b.name) return 'the burger has no accessible name once its visible label is hidden';
    if (b.width < 24 || b.height < 24) return `condensed burger is ${b.width}x${b.height}px, under the 24px minimum tap target`;
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
  'next-performance strip sits below the hero and shows the first date',
  `(() => {
    const strip = document.querySelector('.next');
    const hero = document.querySelector('.hero');
    return JSON.stringify({
      exists: Boolean(strip),
      belowHero: strip && hero
        ? strip.getBoundingClientRect().top >= hero.getBoundingClientRect().top
        : false,
      emptyVisible: Boolean(strip?.querySelector('.next__empty')),
      tickets: strip ? strip.querySelectorAll('.ticket').length : -1,
      when: strip?.querySelector('.ticket__date')?.textContent.trim() ?? null,
    });
  })()`,
  (raw) => {
    const s = JSON.parse(raw);
    const next = program.dates[0];
    if (!s.exists) return 'no .next strip';
    if (!s.belowHero) return 'the strip must sit below the first screen, not above it';
    // Both states are asserted here, so the empty state stays covered when the
    // season ends and dates go back to zero.
    if (!next) {
      if (!s.emptyVisible) return 'no dates, so the empty state must be shown rather than a blank box';
      return s.tickets === 0 ? null : `expected no tickets, got ${s.tickets}`;
    }
    if (s.emptyVisible) return 'dates exist, but the empty state is showing';
    if (s.tickets !== 1) return `the strip shows the next performance only, got ${s.tickets} cards`;
    if (s.when !== next.when) return `showed ${JSON.stringify(s.when)}, first date is ${JSON.stringify(next.when)}`;
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
  'program lists every date she sent, linking the productions that have pages',
  `JSON.stringify({
    heading: document.querySelector('.page-heading')?.textContent.trim(),
    emptyVisible: Boolean(document.querySelector('.program__empty')),
    cards: [...document.querySelectorAll('.ticket')].map((card) => ({
      when: card.querySelector('.ticket__date')?.textContent.trim(),
      links: [...card.querySelectorAll('a')].map((a) => a.getAttribute('href')),
    })),
  })`,
  (raw) => {
    const p = JSON.parse(raw);
    if (p.heading !== 'Program') return `heading was ${JSON.stringify(p.heading)}`;
    if (!program.dates.length) {
      if (!p.emptyVisible) return 'no dates, so the empty state must be shown';
      return p.cards.length === 0 ? null : `expected no cards, got ${p.cards.length}`;
    }
    if (p.emptyVisible) return 'dates exist, but the empty state is showing';
    if (p.cards.length !== program.dates.length) {
      return `${p.cards.length} cards for ${program.dates.length} dates — every date she sent must be listed`;
    }
    for (const [index, date] of program.dates.entries()) {
      const card = p.cards[index];
      if (card.when !== date.when) {
        return `card ${index + 1} reads ${JSON.stringify(card.when)}, expected ${JSON.stringify(date.when)}`;
      }
      // A production with a page is reachable from its date; one without a
      // page must not link anywhere, least of all to a route that does not exist.
      const expected = date.slug ? [`/repertoar/${date.slug}/`] : [];
      const internal = card.links.filter((href) => href?.startsWith('/'));
      if (JSON.stringify(internal) !== JSON.stringify(expected)) {
        return `card ${index + 1} (${date.title}) links ${JSON.stringify(internal)}, expected ${JSON.stringify(expected)}`;
      }
    }
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

// She replaced a wrong name in the cast and was written to us only as
// "Aliska", so this page was pinned to that single name while the full one
// was unknown. It is known now, and the other ten people are all billed in
// full, so she is too. QA.md asks her to confirm the spelling.
onPage('/soubor/aliska/',
  'Aliska is billed under her full name, like everyone else on the site',
  `JSON.stringify({
    heading: document.querySelector('h1')?.textContent.trim(),
    hra: [...document.querySelectorAll('.person__productions a')]
      .some((a) => a.getAttribute('href') === '/repertoar/hra-lasky-a-nahody/'),
  })`,
  (raw) => {
    const r = JSON.parse(raw);
    if (r.heading !== 'Alisa Gertsovskaya') return `heading was ${JSON.stringify(r.heading)}`;
    if (!r.hra) return 'Hra lásky missing from her productions';
    return null;
  },
);

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
  // it snaps instead of animating. Separate visit: media emulation is per-navigation, so this cannot
  // ride inside the main loop. Runs while the static server is still up, so it
  // lives inside this try before the finally below closes it.
  await withBrowser(async (visit) => {
    await visit(`http://127.0.0.1:${PORT}/`, { width: 390, height: 844, reducedMotion: true }, async (evaluate) => {
      const duration = await evaluate(
        `getComputedStyle(document.querySelector('.masthead__home svg')).transitionDuration`,
      );
      const problem = /^0s(, 0s)*$/.test(duration) ? null : `transition-duration is ${duration} under reduced motion`;
      console.log(`${problem ? 'FAIL' : 'pass'}  [reduced-motion /] condense snaps${problem ? ` — ${problem}` : ''}`);
      if (problem) failures.push('reduced motion');

      // Reduced motion means no animation, not no feature. The scroll-driven
      // condense is cancelled along with every other animation, so the stepped
      // fallback has to take over - otherwise these readers keep the tall bar
      // over every screen of the site.
      const heights = await evaluate(`(async () => {
        const settle = () => new Promise((resolve) => setTimeout(resolve, 300));
        const masthead = document.querySelector('.masthead');
        document.body.style.minHeight = '300vh';
        window.scrollTo(0, 0);
        await settle();
        const expanded = +masthead.getBoundingClientRect().height.toFixed(1);
        window.scrollTo(0, 600);
        await settle();
        const scrolled = +masthead.getBoundingClientRect().height.toFixed(1);
        window.scrollTo(0, 0);
        document.body.style.minHeight = '';
        return { expanded, scrolled };
      })()`);
      const stuck = heights.scrolled < heights.expanded
        ? null
        : `bar is still ${heights.scrolled}px after scrolling, same as the expanded ${heights.expanded}px`;
      console.log(`${stuck ? 'FAIL' : 'pass'}  [reduced-motion /] masthead still condenses${stuck ? ` — ${stuck}` : ''}`);
      if (stuck) failures.push('reduced motion condense');
    });
  });

  // The masthead must shrink with the scroll, not flip between two sizes at a
  // threshold. Measured at the midpoint of the condense range: a stepped
  // implementation reads as fully expanded or fully condensed there, a
  // scroll-linked one reads as neither.
  await withBrowser(async (visit) => {
    for (const width of [320, 390]) {
      await visit(`http://127.0.0.1:${PORT}/`, { width, height: 844 }, async (evaluate) => {
        const measured = await evaluate(`(async () => {
          const settle = () => new Promise((resolve) => setTimeout(resolve, 300));
          const masthead = document.querySelector('.masthead');
          document.body.style.minHeight = '300vh';
          const height = async (y) => {
            window.scrollTo(0, y);
            await settle();
            return +masthead.getBoundingClientRect().height.toFixed(1);
          };
          const expanded = await height(0);
          const range = expanded;
          const middle = await height(Math.round(range / 2));
          const condensed = await height(600);
          window.scrollTo(0, 0);
          document.body.style.minHeight = '';
          return {
            expanded,
            middle,
            condensed,
            supported: CSS.supports('animation-timeline', 'scroll()'),
          };
        })()`);
        const { expanded, middle, condensed, supported } = measured;
        const wrong = [];
        if (!supported) wrong.push('browser cannot run scroll-driven animations, so this is unverified');
        if (middle > expanded - 4) wrong.push(`at half the range it is still ${middle}px, barely off the expanded ${expanded}px`);
        if (middle < condensed + 4) wrong.push(`at half the range it is already ${middle}px, essentially the condensed ${condensed}px`);
        const label = `[${width}px /] masthead shrinks with the scroll, not in one step`;
        console.log(`${wrong.length ? 'FAIL' : 'pass'}  ${label}${wrong.length ? ` — ${wrong.join('; ')}` : ''}`);
        if (wrong.length) failures.push(label);
      });
    }
  });

  // Condensed, the button is meant to be bare bars: no border, no fill, and
  // the cherry that was its background carried into the bars themselves
  // (2026-08-18: "udelej jen tmave carky bez okraju a pozadi. prenes pozadi
  // velkeho menu do carek na konci cesty"). Its padding has to actually reach
  // the condensed values too - the first cut of the scroll-driven rules sat
  // above the base .burger rule and lost to it on source order, so the button
  // kept full padding around a collapsed label.
  await withBrowser(async (visit) => {
    await visit(`http://127.0.0.1:${PORT}/`, { width: 390, height: 844 }, async (evaluate) => {
      const measured = await evaluate(`(async () => {
        const settle = () => new Promise((resolve) => setTimeout(resolve, 300));
        // Colours are read by painting them, not by parsing them: color-mix
        // computes to color(srgb ...) while plain colours stay rgb(...), and
        // the comparison is about the colour, not the notation.
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const context = canvas.getContext('2d', { willReadFrequently: true });
        const sample = (colour) => {
          context.clearRect(0, 0, 1, 1);
          context.fillStyle = colour;
          context.fillRect(0, 0, 1, 1);
          const data = context.getImageData(0, 0, 1, 1).data;
          return [data[0], data[1], data[2], Math.round(data[3] / 2.55) / 100];
        };
        const burger = document.querySelector('.burger');
        const bars = document.querySelector('.burger__bars');
        document.body.style.minHeight = '300vh';
        const read = async (y) => {
          window.scrollTo(0, y);
          await settle();
          const style = getComputedStyle(burger);
          return {
            background: sample(style.backgroundColor),
            border: sample(style.borderTopColor),
            bar: sample(getComputedStyle(bars).getPropertyValue('--bar').trim()),
            padding: parseFloat(style.paddingLeft),
            gap: parseFloat(style.columnGap),
          };
        };
        const top = await read(0);
        const scrolled = await read(600);
        window.scrollTo(0, 0);
        document.body.style.minHeight = '';
        return { top, scrolled };
      })()`);
      const { top, scrolled } = measured;
      const CHERRY = [170, 10, 39];
      const CREAM = [255, 254, 205];
      const near = (colour, target) => colour
        && colour[3] > 0.99
        && target.every((channel, index) => Math.abs(colour[index] - channel) <= 2);
      const wrong = [];
      if (!near(top.background, CHERRY)) wrong.push(`at the top the button is not cherry (${top.background})`);
      if (!near(top.bar, CREAM)) wrong.push(`at the top the bars are not cream (${top.bar})`);
      if (scrolled.background?.[3] !== 0) wrong.push(`condensed the button still has a fill (alpha ${scrolled.background?.[3]})`);
      if (scrolled.border?.[3] !== 0) wrong.push(`condensed the button still has a border (alpha ${scrolled.border?.[3]})`);
      if (!near(scrolled.bar, CHERRY)) wrong.push(`condensed the bars are not cherry (${scrolled.bar})`);
      if (!(scrolled.padding < top.padding)) wrong.push(`padding did not shrink: ${top.padding} -> ${scrolled.padding}`);
      if (scrolled.gap !== 0) wrong.push(`condensed the gap beside the dropped label is still ${scrolled.gap}px`);
      const label = '[/] condensed burger reduces to bare cherry bars';
      console.log(`${wrong.length ? 'FAIL' : 'pass'}  ${label}${wrong.length ? ` — ${wrong.join('; ')}` : ''}`);
      if (wrong.length) failures.push(label);
    });
  });

  // Shrinking the masthead must not reflow the page. The bar is out of flow
  // and a constant-height spacer holds its place, so scrolling through the
  // whole condense range must leave the document the same height and every
  // element below exactly where it was. When the bar was in flow this drifted
  // 21.8px and scroll anchoring then dragged the reader off their position.
  await withBrowser(async (visit) => {
    for (const width of [320, 390]) {
      await visit(`http://127.0.0.1:${PORT}/`, { width, height: 844 }, async (evaluate) => {
        const samples = await evaluate(`(async () => {
          const settle = () => new Promise((resolve) => setTimeout(resolve, 250));
          const below = document.querySelector('main').firstElementChild;
          const out = [];
          for (const y of [0, 20, 40, 74, 120, 300, 40, 0]) {
            window.scrollTo(0, y);
            await settle();
            out.push({
              scrollY: Math.round(window.scrollY),
              requested: y,
              documentHeight: document.documentElement.scrollHeight,
              contentTop: +(below.getBoundingClientRect().top + window.scrollY).toFixed(1),
            });
          }
          window.scrollTo(0, 0);
          return out;
        })()`);
        const first = samples[0];
        const wrong = [];
        for (const sample of samples) {
          if (sample.documentHeight !== first.documentHeight) {
            wrong.push(`at ${sample.requested}px the document is ${sample.documentHeight}, was ${first.documentHeight}`);
            break;
          }
        }
        for (const sample of samples) {
          if (Math.abs(sample.contentTop - first.contentTop) > 0.5) {
            wrong.push(`at ${sample.requested}px the content below moved ${(sample.contentTop - first.contentTop).toFixed(1)}px`);
            break;
          }
        }
        // Scroll anchoring compensating for a resize shows up as a scroll that
        // does not land where it was sent.
        const missed = samples.find((sample) => Math.abs(sample.scrollY - sample.requested) > 1);
        if (missed) wrong.push(`scrollTo(${missed.requested}) landed at ${missed.scrollY}`);
        const label = `[${width}px /] scrolling through the condense does not reflow the page`;
        console.log(`${wrong.length ? 'FAIL' : 'pass'}  ${label}${wrong.length ? ` — ${wrong.join('; ')}` : ''}`);
        if (wrong.length) failures.push(label);
      });
    }
  });

  // The cloud ground rides on body, which propagates to the canvas: that is
  // what makes it cover a document of any length and scroll with the text.
  // Checked as computed values, since the tile size and the repeat are the two
  // things that would silently go back to a stretched single image.
  await withBrowser(async (visit) => {
    await visit(`http://127.0.0.1:${PORT}/`, { width: 390, height: 844 }, async (evaluate) => {
      const measured = await evaluate(`(() => {
        const style = getComputedStyle(document.body);
        return {
          size: style.backgroundSize,
          repeat: style.backgroundRepeat,
          attachment: style.backgroundAttachment,
          image: style.backgroundImage,
          tile: getComputedStyle(document.documentElement).getPropertyValue('--cloud-tile').trim(),
        };
      })()`);
      const wrong = [];
      if (!measured.image.includes('clouds.svg')) wrong.push(`image is ${measured.image}`);
      if (measured.size !== `${measured.tile} ${measured.tile}`) wrong.push(`size is ${measured.size}, tile is ${measured.tile}`);
      if (measured.repeat !== 'repeat') wrong.push(`repeat is ${measured.repeat}`);
      if (measured.attachment !== 'scroll') wrong.push(`attachment is ${measured.attachment}, so it will not scroll with the text`);
      const label = '[/] cloud ground tiles on body and scrolls with the page';
      console.log(`${wrong.length ? 'FAIL' : 'pass'}  ${label}${wrong.length ? ` — ${wrong.join('; ')}` : ''}`);
      if (wrong.length) failures.push(label);
    });
  });

} finally {
  server.close();
  server.closeAllConnections?.();
}

if (failures.length > 0) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nall checks passed: ${EXPECTED_ROUTES.length} routes x ${widths.length} widths`);
