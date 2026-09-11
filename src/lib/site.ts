import { load } from 'js-yaml';
import { parseSite } from './site-schema.mjs';
// `?raw` liest die Datei als Text in den Build hinein. Kein Dateizugriff zur
// Laufzeit, deshalb funktioniert der statische Build überall identisch.
import raw from '../../site.yaml?raw';

// js-yaml hat keinen Default-Export — `import { load }` ist in Astro-Builds
// der stabile Weg (der Default-Import scheitert im Prerender-Bundle).
const parsed = parseSite(load(raw));

if (!parsed.ok) {
  // Ein Fehler in der Konfiguration ist ein Build-Fehler mit Ort und Grund,
  // nicht eine stille Standardwerte-Biegung.
  const details = parsed.issues.map((i) => `  - ${i.path}: ${i.message}`).join('\n');
  throw new Error(`site.yaml ist ungültig (AGENTS.md R-05):\n${details}`);
}

export const site = parsed.data;

/** Indexierte Seiten des Lebenszyklus (R-21). */
export const isProduction = site.lifecycle === 'production';
