# Seitenvorlage

Kopieren nach `src/content/pages/<name>.md`, dann ausfüllen. Der Dateiname bestimmt
die URL: `leistungen.md` → `/leistungen/`, `team/anna.md` → `/team/anna/`.
`start.md` ist die Startseite.

```markdown
---
title: Seitentitel                                   # Pflicht, 2–70 Zeichen
description: Ein Satz, der zeigt, was hier steht.    # Pflicht, 20–200 Zeichen
slug: /optional-eigener-pfad/                        # optional, sonst Dateiname
draft: false                                         # true = bleibt im Repo, erscheint nicht
noindex: false                                       # true = nicht für Suchmaschinen
updated: 2026-01-01                                  # optional
---

## Überschrift

Inhalte beginnen mit `h2`, die `h1` liefert das Layout aus dem `title`.

Interne Links absolut schreiben: [Zur Leistung](/leistungen/).
Bilder immer mit Alt-Text: ![Was zu sehen ist](/assets/bild.png).

Beleg für diese Aussage: `input/documents/prospekt-2026.pdf`, Seite 3.
```

## Prüfen

```bash
npm run validate   # Quellenzustand
npm run build      # Build und Ausgabe
```

## Nach dem Anlegen (R-08)

- [ ] in `site.yaml` unter `nav:` oder `footer:` eingetragen, wenn sichtbar
- [ ] von mindestens einer anderen Seite verlinkt
- [ ] `description` beschreibt die Seite, nicht den Markenkern
- [ ] keine Aussage ohne Beleg in `input/` (R-07)
