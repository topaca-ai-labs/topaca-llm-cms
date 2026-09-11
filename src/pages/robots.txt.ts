import type { APIRoute } from 'astro';
import { isProduction, site } from '../lib/site';

// robots.txt aus dem Lebenszyklus (R-21), nicht aus einer statischen Datei.
// development: nichts indexieren. production: indexieren, Sitemap benennen.
// Ein statisches robots.txt war v0.1 ein Widerspruch zum Platzhalterzustand.
export const GET: APIRoute = ({ site: astroSite }) => {
  const base = (astroSite ?? new URL(site.url)).href.replace(/\/$/, '');
  const body = isProduction
    ? ['User-agent: *', 'Allow: /', '', `Sitemap: ${base}/sitemap.xml`, ''].join('\n')
    : ['User-agent: *', 'Disallow: /', '', '# lifecycle: development — nicht zur Indexierung freigegeben (AGENTS.md R-21).', ''].join('\n');

  return new Response(body, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
};
