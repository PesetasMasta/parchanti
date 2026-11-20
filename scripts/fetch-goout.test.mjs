// What the GoOut fetch keeps from the venue's archive. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ourTitles } from './fetch-goout.mjs';

// Rychlé šípy is not attributed to the company on GoOut and reaches the cache
// only through the venue query, kept by title. Before 2026-11-20 the titles
// came from program.json alone, so pruning its old Šípy entries - which the
// new arrangement invites - would have dropped Šípy from the cache (review,
// 2026-11-20). A production with a page must keep its title regardless.
test('a production with a page is kept even when program.json never names it', () => {
  const root = mkdtempSync(join(tmpdir(), 'goout-titles-'));
  mkdirSync(join(root, 'data'));
  mkdirSync(join(root, 'src/content/productions'), { recursive: true });
  writeFileSync(join(root, 'data/program.json'), JSON.stringify({
    dates: [{ date: '2026-12-09', time: '18:00', title: 'Toníkova cesta' }],
  }));
  writeFileSync(join(root, 'src/content/productions/sipy.json'), JSON.stringify({
    titleLead: 'Rychlé šípy',
    titleRest: 'a záhada klubovny',
  }));

  const titles = ourTitles(root);
  assert.ok(titles.includes('Rychlé šípy a záhada klubovny'));
  assert.ok(titles.includes('Toníkova cesta'));
});
