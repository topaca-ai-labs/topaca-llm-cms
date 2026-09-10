import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// Deterministische Validierung des Inhalts (Werkzeugkette, nicht Modell):
// astro sync / astro build schlagen fehl, wenn Frontmatter fehlt oder
// diesem Schema widerspricht. Regel R-06 in AGENTS.md.
const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string().min(2).max(70),
    description: z.string().min(20).max(200),
    // URL-Pfad; wenn nicht angegeben, aus dem Dateinamen abgeleitet (R-10).
    slug: z
      .string()
      .regex(/^\/[a-z0-9\/-]*$/, 'slug muss mit / beginnen und kebab-case sein')
      .optional(),
    draft: z.boolean().default(false),
    noindex: z.boolean().default(false),
    updated: z.coerce.date().optional(),
  }),
});

export const collections = { pages };
