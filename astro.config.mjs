import { defineConfig } from 'astro/config';
import { readFileSync } from 'node:fs';
import { load } from 'js-yaml';

// site.yaml ist die einzige Quelle für die Domain (R-05).
// Astro braucht sie für kanonische URLs und die Sitemap.
const site = load(readFileSync(new URL('./site.yaml', import.meta.url), 'utf8'));

export default defineConfig({
  site: site.url,
  output: 'static',
  trailingSlash: 'ignore',
  build: {
    inlineStylesheets: 'always',
  },
});
