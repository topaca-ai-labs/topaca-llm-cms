/**
 * Einzelne URL-Autorität (AGENTS.md R-10).
 *
 * Diese Datei ist der einzige Ort, an dem aus einer Seite ein Pfad wird und aus
 * einem Link ein Vergleichspfad. Renderer (`src/lib/page.ts`), Schema
 * (`src/content.config.ts`) und Validator (`scripts/check.mjs`) benutzen
 * dieselbe Funktion. Genau diese Trennung war in v0.1 ein Fehler: Validator und
 * Renderer hatten zwei Vorstellungen von der Startseite und von `/foo` vs. `/foo/`.
 *
 * Reines JavaScript mit JSDoc-Typen, damit Node es ohne Übersetzung importieren
 * kann. Regel R-16: eine Mechanik, eine Implementierung.
 */

/** Ein Pfadsegment: kleingeschrieben, kebab-case, ASCII. */
export const SEGMENT_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Kanonischer Routenpfad: `/` oder `/a/`, `/a/b/`. Kein Query, kein Fragment. */
export const CANONICAL_ROUTE_RE = /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/;

/** Dateiendungen schließen eine Seite als Route aus. */
const EXTENSION_RE = /\.[a-z0-9]{2,5}$/;

/** Dateinamen, die die Startseite belegen. Nur `start.md` ist erlaubt (R-06). */
export const HOME_ID = 'start';
export const RESERVED_IDS = ['start', 'index'];

/**
 * Zerlegt ein Linkziel in Pfad, Query und Fragment.
 * Query und Fragment gehören nicht zur Route und dürfen sie nie unverlinkt machen.
 */
export function splitTarget(target) {
  const raw = String(target ?? '');
  const hashAt = raw.indexOf('#');
  const withoutFragment = hashAt === -1 ? raw : raw.slice(0, hashAt);
  const fragment = hashAt === -1 ? '' : raw.slice(hashAt + 1);
  const queryAt = withoutFragment.indexOf('?');
  return {
    path: queryAt === -1 ? withoutFragment : withoutFragment.slice(0, queryAt),
    query: queryAt === -1 ? '' : withoutFragment.slice(queryAt + 1),
    fragment,
  };
}

/**
 * Kanonische Form eines Pfads — oder null, wenn der Pfad keine Route sein kann.
 * `/leistungen` und `/leistungen//` werden zu `/leistungen/`.
 */
export function canonical(input) {
  const { path } = splitTarget(input);
  if (!path.startsWith('/')) return null;
  const segments = path.split('/').filter(Boolean);
  const route = segments.length === 0 ? '/' : `/${segments.join('/')}/`;
  return CANONICAL_ROUTE_RE.test(route) ? route : null;
}

/** Segmente, die gegen R-10 verstoßen (Großbuchstaben, Umlaute, Leerzeichen, `..`). */
export function invalidSegments(input) {
  const { path } = splitTarget(input);
  return path.split('/').filter(Boolean).filter((segment) => !SEGMENT_RE.test(segment));
}

/** Ist das Ziel eine Seite (ohne Dateiendung)? */
export function isPagePath(input) {
  const { path } = splitTarget(input);
  return !EXTENSION_RE.test(path.split('/').pop() ?? '');
}

/**
 * Route einer Seite. `slug` ist optional; wenn gesetzt, muss er bereits
 * kanonisch sein (das Schema erzwingt es, der Validator meldet die Regel).
 * Die Startseite ist ausschließlich `src/content/pages/start.md`.
 */
export function routeForPage(id, slug) {
  if (slug !== undefined && slug !== null) return canonical(slug);
  const base = String(id).replace(/\.md$/, '');
  if (base === HOME_ID) return '/';
  return canonical(`/${base}`);
}

/** Startseite: ausschließlich start.md, kein anderer slug (R-06). */
export function isHomeId(id) {
  return String(id).replace(/\.md$/, '') === HOME_ID;
}

/** Datei im Build für eine Route. */
export function outputFileFor(route) {
  return route === '/' ? 'index.html' : `${route.slice(1)}index.html`;
}
