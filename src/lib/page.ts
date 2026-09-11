import type { CollectionEntry } from 'astro:content';
import { outputFileFor, routeForPage } from './route.mjs';

/**
 * URL einer Seite: explizites `slug` aus dem Frontmatter, sonst aus dem
 * Dateinamen abgeleitet. Die Mechanik selbst liegt in `route.mjs` — dort, wo
 * auch der Validator sie benutzt (R-10). Diese Datei ist nur der Adapter für
 * Astro-Einträge.
 */
export function pathFor(entry: CollectionEntry<'pages'>): string {
  const route = routeForPage(entry.id, entry.data.slug);
  if (!route) {
    throw new Error(`Route für ${entry.id} ist nicht kanonisch (AGENTS.md R-10): slug="${entry.data.slug}"`);
  }
  return route;
}

/** Datei im Build, in die diese Seite geschrieben wird. */
export function outputFile(entry: CollectionEntry<'pages'>): string {
  return outputFileFor(pathFor(entry));
}
