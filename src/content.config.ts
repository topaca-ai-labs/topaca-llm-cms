import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import { CANONICAL_ROUTE_RE } from './lib/route.mjs';

// Deterministische Validierung des Inhalts (Werkzeugkette, nicht Modell):
// astro sync / astro build schlagen fehl, wenn Frontmatter fehlt oder diesem
// Schema widerspricht. Regel R-06 in AGENTS.md.
//
// Die Regex für die URL kommt aus src/lib/route.mjs — dieselbe Quelle wie der
// Validator. Zwei Vorstellungen von "gültiger Pfad" waren ein v0.1-Fehler.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string().min(2).max(70),
    description: z.string().min(20).max(200),
    // URL-Pfad. Nur kanonische Form: `/` oder `/pfad/` (R-10).
    slug: z
      .string()
      .regex(CANONICAL_ROUTE_RE, 'slug muss kanonisch sein: / oder /pfad/, kleingeschrieben, kebab-case')
      .optional(),
    draft: z.boolean().default(false),
    noindex: z.boolean().default(false),
    // Kontaktwerte stehen in site.yaml; diese Seite rendert sie (R-05).
    contact: z.boolean().default(false),
    // Belege für Aussagen auf dieser Seite, Pfade innerhalb von input/ (R-07).
    sources: z.array(z.string().min(1)).default([]),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { pages };
