import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { pathFor } from '../lib/page';

// Sitemap als normale Astro-Route — kein zusätzliches Werkzeug (R-16).
export const GET: APIRoute = async ({ site }) => {
  const pages = await getCollection('pages', ({ data }) => !data.draft && !data.noindex);
  const urls = pages
    .map((entry) => pathFor(entry))
    .sort()
    .map((path) => `  <url><loc>${new URL(path, site!).href}</loc></url>`)
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  return new Response(xml, { headers: { 'content-type': 'application/xml' } });
};
