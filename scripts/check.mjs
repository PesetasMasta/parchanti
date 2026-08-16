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

    // window.innerWidth is not a safe yardstick: when content that cannot
    // wrap (an unbreakable word) is wider than the viewport, mobile browsers
    // silently widen the layout viewport to fit it, so innerWidth grows right
    // along with the overflow and the comparison below would never fire.
    // document.documentElement.clientWidth stays pinned to the real,
    // requested viewport width regardless, so it is the trustworthy measure.
    //
    // This still can't see paint-only overflow from text-shadow, box-shadow,
    // or filter: drop-shadow - those paint outside the layout box without
    // affecting it or scrollWidth, so they're invisible to both checks below.
    // Deliberate: paint overflow cannot cause horizontal scrolling, which is
    // the one thing this guard exists to catch.
    const clientWidth = document.documentElement.clientWidth;
    const scrollWidth = document.documentElement.scrollWidth;

    const problems = [];
    // Catches the case above directly: if the document itself can scroll
    // sideways, something overflowed even if no single element's own rect
    // appears to cross the (possibly widened) edge.
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
    // NOTE: the brief's markdown had this literal without a trailing space,
    // but slice(0, 24) on the trimmed pitch always includes the space before
    // "se" (it sits mid-line in the client's copy, not at a wrap point) —
    // 'Divadelní soubor, který' is 23 chars, so a 24-char slice can never
    // equal it. Most likely a trailing space stripped when the brief was
    // saved. Restored here so the check tests what it evidently intended.
    if (hero.pitchStart !== 'Divadelní soubor, který ') return `pitch was ${JSON.stringify(hero.pitchStart)}`;
    if (!hero.claimIsPlaceholder) return 'claim slot is not marked data-placeholder';
    if (!hero.claimIsEmpty) return 'claim slot should stay empty until Zuzka sends it';
    return null;
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
