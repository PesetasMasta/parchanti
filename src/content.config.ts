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
    // Two-part titles are a design device, not a rule: "Rychlé šípy /
    // a záhada klubovny" is a name plus a subtitle and reads as two sizes,
    // while "Hra lásky a náhody" is one phrase and must read as one heading
    // (client, 2026-08-31). A production with no subtitle simply omits
    // titleRest rather than being special-cased per slug in three templates.
    titleLead: z.string(),
    titleRest: z.string().optional(),
    blurb: z.string(),
    annotation: z.string(),
    creditsBefore: z.array(creditRow),
    // Cast as alternation groups: [["a"], ["b", "c"]] renders as "A, B / C".
    // Slugs, not names - names come from the people collection, so the
    // cross-linking is never maintained by hand.
    cast: z.array(z.array(personSlug)),
    creditsAfter: z.array(creditRow),
    // Real fields, not prose inside creditsAfter: the program page renders
    // both beside every date (client, 2026-08-31), and parsing "1 h 15 min,
    // bez přestávky" back out of a credit row is not a data model.
    // Optional because Hra lásky has no confirmed running time yet.
    durationMinutes: z.number().int().positive().optional(),
    ageRating: z.string().optional(),
    // The mini poster she asks for beside every date. No artwork exists in
    // the repo for any production yet, so every date currently renders the
    // placeholder; a photo panel is not a substitute for a poster.
    poster: z.object({
      src: z.string(),
      alt: z.string(),
      width: z.number().int(),
      height: z.number().int(),
    }).optional(),
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
    // Her own wording from the roster she sent 2026-08-31, verbatim -
    // "umělecký šéf divadla, režisér, scénograf, herec", not our "hraje".
    role: z.string(),
    // Which of her two lists this person is on. The page separates them
    // under their own headings, so it cannot be derived from the credits.
    group: z.enum(['soubor', 'host']),
    // Her numbering from the roster she sent, which is the billing order.
    // Explicit because getCollection() returns entries sorted by id, not in
    // file order - the old page was alphabetical by slug without anyone
    // meaning it to be.
    order: z.number().int().positive(),
    // No portrait is lawfully available for anyone yet (sourcing settled
    // 2026-08-17); the roster renders placeholder blocks until the company
    // sends their own.
    portrait: z.object({
      src: z.string(),
      alt: z.string(),
      width: z.number().int(),
      height: z.number().int(),
    }).optional(),
    // Optional: two members have no researched sentence yet, and their pages
    // must render without one rather than showing a gap.
    bio: z.string().optional(),
  }),
});

export const collections = { productions, people };
