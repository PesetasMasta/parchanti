// Unit tests for schedule(): which dates the site shows, merged from her hand
// list and the GoOut cache. Run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schedule } from '../src/lib/program.js';

const SIPY = 101;
const AUDIENCE = 102;

const productions = [
  { slug: 'sipy', title: 'Rychlé šípy a záhada klubovny' },
  { slug: 'nova', title: 'Nová hra' },
];

function row(scheduleId, eventId, start, overrides = {}) {
  return {
    scheduleId,
    gooutEventId: eventId,
    start,
    cancelled: false,
    ticketingState: 'ACTIVE',
    ticketUrl: `https://goout.net/en/x/s${scheduleId}/`,
    ...overrides,
  };
}

const goout = {
  productions: [
    // GoOut sells it under the short title; ours is the full one.
    { gooutEventId: SIPY, title: 'Rychlé šípy', attributed: false },
    { gooutEventId: AUDIENCE, title: 'Audience (Pivařská Odyssea)', attributed: true },
  ],
  dates: [
    row(1, SIPY, '2026-12-03T20:00:00+01:00'),
    row(2, SIPY, '2026-12-10T20:00:00+01:00', { cancelled: true, ticketingState: 'CANCELLED' }),
    row(3, SIPY, '2026-12-12T20:00:00+01:00', { ticketingState: 'CANCELLED' }),
    row(4, SIPY, '2026-10-16T18:00:00+02:00', { ticketingState: 'ENDED' }),
    row(5, SIPY, '2026-12-20T20:00:00+01:00', { ticketingState: 'SOLD_OUT' }),
    row(6, SIPY, '2026-06-05T18:00:00+02:00'),
    row(7, AUDIENCE, '2026-12-05T20:00:00+01:00'),
  ],
};

const hand = [
  { date: '2026-11-14', time: '20:00', when: 'so 14. 11. 20:00', title: 'Rychlé šípy a záhada klubovny', slug: 'sipy', state: 'announced' },
  { date: '2026-12-03', time: '20:00', when: 'čt 3. 12. 20:00', title: 'Rychlé šípy a záhada klubovny', slug: 'sipy', note: 'derniéra', state: 'announced' },
  { date: '2026-12-15', time: '19:00', when: 'út 15. 12. 19:00', title: 'Nová hra', slug: 'nova', note: 'premiéra', state: 'announced' },
  { date: '2026-12-09', time: '18:00', when: 'st 9. 12. 18:00', title: 'Toníkova cesta', state: 'announced' },
];

const result = schedule(hand, goout, productions);
const on = (date) => result.filter((entry) => entry.date === date);

test('goout dates replace hand dates for a listed production', () => {
  assert.equal(on('2026-11-14').length, 0);
  const [entry] = on('2026-12-03');
  assert.equal(entry.slug, 'sipy');
  assert.equal(entry.title, 'Rychlé šípy a záhada klubovny');
  assert.equal(entry.when, 'čt 3. 12. 20:00');
});

test('cancelled goout dates are dropped', () => {
  assert.equal(on('2026-12-10').length, 0);
  assert.equal(on('2026-12-12').length, 0);
});

test('not on sale yet is announced without a link', () => {
  const [entry] = on('2026-10-16');
  assert.equal(entry.state, 'announced');
  assert.equal(entry.url, undefined);
});

test('sold out keeps its state', () => {
  assert.equal(on('2026-12-20')[0].state, 'sold_out');
});

test('summer offset keeps local time', () => {
  const [entry] = on('2026-06-05');
  assert.equal(entry.time, '18:00');
  assert.equal(entry.when, 'pá 5. 6. 18:00');
});

test('hand note survives on the same day', () => {
  const entries = on('2026-12-03');
  assert.equal(entries.length, 1);
  assert.equal(entries[0].note, 'derniéra');
  assert.ok(entries[0].url.startsWith('https://goout.net/cs/'));
  assert.equal(entries[0].state, 'on_sale');
});

test('production missing from goout keeps hand dates', () => {
  assert.deepEqual(on('2026-12-15'), [hand[2]]);
});

test('no page, no goout date', () => {
  assert.ok(!result.some((entry) => entry.title.startsWith('Audience')));
  assert.equal(on('2026-12-05').length, 0);
});

test('hand entries without a slug pass through withTickets', () => {
  assert.deepEqual(on('2026-12-09'), [hand[3]]);
});

test('entries come out in date order', () => {
  const dates = result.map((entry) => entry.date);
  assert.deepEqual(dates, [...dates].sort());
});
