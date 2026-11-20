// The one place a page gets its dates from: her hand list merged with the
// GoOut cache by schedule(), for every production that has a page.
// scripts/check.mjs makes the same call from the same files.
import { getCollection } from 'astro:content';
import program from '../../data/program.json';
import goout from '../../data/goout.json';
import { schedule } from './program.js';

export async function siteDates() {
  const productions = (await getCollection('productions')).map((production) => ({
    slug: production.id,
    title: [production.data.titleLead, production.data.titleRest].filter(Boolean).join(' '),
  }));
  return schedule(program.dates, goout, productions);
}
