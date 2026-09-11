/**
 * Schema für site.yaml — die kanonische Konfiguration (AGENTS.md R-05).
 *
 * Dasselbe Schema lesen Renderer (src/lib/site.ts) und Validator
 * (scripts/check.mjs). Eine fehlerhafte Konfiguration erzeugt damit immer eine
 * benannte Diagnose mit Ort, nie einen Stacktrace (Audit §17).
 *
 * `.strict()`: ein Tippfehler wie `navi:` ist ein Fehler, keine unbemerkte
 * Stilllegung der Navigation.
 */
import { z } from 'zod';
import { CANONICAL_ROUTE_RE } from './route.mjs';

export const NavEntrySchema = z.object({
  label: z.string().min(1, 'label fehlt'),
  href: z
    .string()
    .regex(/^\//, 'href muss mit / beginnen')
    .regex(CANONICAL_ROUTE_RE, 'href muss ein kanonischer Pfad sein: / oder /pfad/'),
});

export const ContactSchema = z
  .object({
    email: z.string().min(1).optional(),
    phone: z.string().min(1).optional(),
    address: z.string().min(1).optional(),
  })
  .strict();

export const SiteSchema = z
  .object({
    name: z.string().min(1, 'name fehlt'),
    tagline: z.string().min(1).optional(),
    url: z
      .string()
      .regex(/^https:\/\/[^/]+[^/]?$/, 'url muss https://… ohne abschließenden Slash sein'),
    language: z.string().regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'language muss ein BCP-47-Kürzel sein, z. B. de'),
    // Lebenszyklus (R-21): development ist der sichere Standard — nicht
    // indexierbar, Platzhalter erlaubt. production ist eine ausdrückliche Entscheidung.
    lifecycle: z.enum(['development', 'production']).default('development'),
    nav: z.array(NavEntrySchema).min(1, 'nav braucht mindestens einen Eintrag'),
    footer: z.array(NavEntrySchema).default([]),
    contact: ContactSchema.optional(),
  })
  .strict();

/** @typedef {z.infer<typeof SiteSchema>} SiteConfig */

/**
 * Parse mit kontrollierter Rückgabe.
 * @returns {{ ok: true, data: SiteConfig } | { ok: false, issues: { path: string, message: string }[] }}
 */
export function parseSite(raw) {
  const result = SiteSchema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    issues: result.error.issues.map((issue) => ({
      path: issue.path.length ? issue.path.join('.') : '(wurzel)',
      message: issue.message,
    })),
  };
}
