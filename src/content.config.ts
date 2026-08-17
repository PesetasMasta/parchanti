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
