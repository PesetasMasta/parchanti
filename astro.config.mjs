// Static site. Deployment is deferred by decision: no base path is set, so
// links are root-relative and the built site must be previewed over HTTP
// (node scripts/serve.mjs dist), not file://.
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://kolekceparchant.cz',
});
