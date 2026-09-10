import { load } from 'js-yaml';
// `?raw` liest die Datei als Text in den Build hinein. Kein Dateizugriff zur
// Laufzeit, deshalb funktioniert der statische Build überall identisch.
import raw from '../../site.yaml?raw';

export type NavEntry = { label: string; href: string };

export type SiteConfig = {
  name: string;
  tagline?: string;
  url: string;
  language: string;
  nav: NavEntry[];
  footer: NavEntry[];
  contact?: { email?: string; phone?: string; address?: string };
};

// js-yaml hat keinen Default-Export — `import { load }` ist in Astro-Builds
// der stabile Weg (der Default-Import scheitert im Prerender-Bundle).
export const site: SiteConfig = load(raw) as SiteConfig;
