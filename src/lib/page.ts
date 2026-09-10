import type { CollectionEntry } from 'astro:content';

/**
 * URL einer Seite: explizites `slug` aus dem Frontmatter, sonst aus dem
 * Dateinamen abgeleitet (R-10). `start.md` und `index.md` sind die Startseite.
 */
export function pathFor(entry: CollectionEntry<'pages'>): string {
  if (entry.data.slug) return entry.data.slug;
  const base = entry.id.replace(/\.md$/, '');
  if (base === 'start' || base === 'index') return '/';
  return '/' + base.split('/').join('/') + '/';
}

/** Seitenpfad relativ zur Website-Wurzel, ohne führenden Slash. */
export function outputFileFor(entry: CollectionEntry<'pages'>): string {
  const p = pathFor(entry);
  return p === '/' ? 'index.html' : `${p.replace(/^\//, '')}index.html`;
}
