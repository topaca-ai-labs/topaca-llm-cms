# Seitenvorlage

Kopieren nach `src/content/pages/<name>.md`, dann ausfüllen. Der Dateiname bestimmt
die URL: `leistungen.md` → `/leistungen/`, `team/anna.md` → `/team/anna/`.
Die Startseite ist **ausschließlich** `start.md`; `index` ist ein reservierter Name und
`slug: /` kann sie nicht ersetzen (R-06, R-10).

```markdown
---
title: Seitentitel                                   # Pflicht, 2–70 Zeichen
description: Ein Satz, der zeigt, was hier steht.    # Pflicht, 20–200 Zeichen
slug: /optional-eigener-pfad/                        # optional; nur kanonisch, mit Schluss-Slash
draft: false                                         # true = bleibt im Repo, erscheint nicht
noindex: false                                       # true = zusätzlich nicht für Suchmaschinen
contact: false                                       # true = rendert die Kontaktwerte aus site.yaml
sources:                                             # Belege für Aussagen auf dieser Seite
  - input/documents/prospekt-2026.pdf                # muss existieren und in input/ liegen
updated: 2026-01-01                                  # optional, von Menschen gesetzt
---

## Überschrift

Inhalte beginnen mit `h2`, die `h1` liefert das Layout aus dem `title`.

Interne Links absolut schreiben: [Zur Leistung](/leistungen/).
Sprungmarken: [Details](/leistungen/#details) — das Ziel wird im Build geprüft.
Bilder immer mit Alt-Text: ![Was zu sehen ist](/assets/bild.png).
```

## Was das Schema erzwingt

`src/content.config.ts` ist verbindlich: `astro sync` und `astro build` schlagen fehl,
wenn Frontmatter fehlt oder widerspricht. `scripts/check.mjs` meldet zusätzlich die
Stellen, die ein Schema nicht sieht (tote Links, Erreichbarkeit, Pfadsegmente,
Platzhalter).

| Feld | Regel |
| --- | --- |
| `title` | 2–70 Zeichen, wird zur `h1` und zum `<title>` |
| `description` | 20–200 Zeichen, beschreibt **diese** Seite, nicht die Marke |
| `slug` | nur kanonisch: `/` oder `/pfad/`, kleingeschrieben, kebab-case, keine Umlaute |
| `draft` | erscheint nicht im Build; verlinkte Drafts sind Fehler |
| `noindex` | Meta-robots der Seite; im `lifecycle: development` ist ohnehin alles gesperrt (R-21) |
| `contact` | `true` rendert `site.yaml → contact`; Werte nie in die Seite schreiben (R-05) |
| `sources` | Pfade innerhalb `input/`, müssen existieren; Belegpflicht nach R-07 |
| `updated` | optionale Datumsangabe von Menschen; der Build erzeugt keine Zeitstempel (R-12) |

## Inhalt ist Inhalt (R-22)

Astro lässt HTML in Markdown zu. Diese Website nutzt das nicht:

- kein `<script>`, `<iframe>`, `<form>`, `<object>`, keine `javascript:`-URL,
  keine `on…`-Event-Handler
- kein Inline-Styling (R-09)
- was wie Darstellung aussieht, gehört ins Layout oder in eine Komponente — beides
  Control Plane und damit nicht Sache eines contentbauenden Agenten (R-19)

Der Validator meldet solche Konstrukte als `UNSAFE_MARKDOWN`. Der Grund ist nicht
Angst vor dem eigenen Inhalt, sondern die Tatsache, dass Material aus `input/`
unbekannter Herkunft zu Inhalt wird (R-18): was als HTML durchrutscht, wird im Browser
ausgeführt.

## Prüfen

```bash
npm run validate   # Quellenzustand
npm run build      # Build und Ausgabe
npm test           # Werkzeugkette
```

## Nach dem Anlegen (R-08)

- [ ] in `site.yaml` unter `nav:` oder `footer:` eingetragen, wenn sichtbar
- [ ] von mindestens einer anderen Seite verlinkt (sonst `UNREACHABLE`)
- [ ] `description` beschreibt die Seite, nicht den Markenkern
- [ ] keine Aussage ohne Beleg; `sources:` nennt das Material (R-07)
- [ ] kein HTML im Markdown (R-22)
- [ ] Kontaktwerte nicht abgeschrieben, sondern `contact: true` (R-05)
