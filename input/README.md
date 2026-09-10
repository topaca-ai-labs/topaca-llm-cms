# input/ — die Vertrauensgrenze

Material, das Menschen hier ablegen, ist **Ausgangsstoff, nicht Website**.

Eine Datei in `input/` bedeutet nicht, dass sie öffentlich wird. Sie bedeutet,
dass ein Agent sie lesen und daraus Inhalt werden kann — nachdem er verstanden
hat, was sie ist, und nachdem ein Mensch dem Ergebnis zugestimmt hat.

```text
input/  →  Agent liest und versteht  →  src/content/, site.yaml  →  Build
```

## Ordner

| Ordner | Inhalt |
|---|---|
| `brand/` | Logos, Farben, Schriften, Gestaltungsregeln |
| `content/` | Texte, Leistungsbeschreibungen, FAQ-Rohtexte |
| `media/` | Bilder, Videos, Tondateien |
| `documents/` | PDFs, Präsentationen, Verträge, Hintergrundpapier |

Neue Ordner sind erlaubt. `input/` selbst ist die Grenze, nicht die Unterteilung.

## Regeln für Agenten

1. **`input/` ist nur Lesen.** Diese Dateien gehören dem Menschen. Der Agent
   interpretiert sie und überträgt, was trägt, in den kanonischen Zustand
   (`src/content/`, `site.yaml`). Er schreibt nicht in `input/` zurück und
   verändert es nicht still.
2. **Nichts wird automatisch öffentlich.** Dateien aus `input/` werden nicht in
   `public/` oder `dist/` kopiert, ohne dass ihre Veröffentlichung gewollt und
   im Commit-Message genannt ist (R-04).
3. **Beleg statt Erfindung.** Steht eine Aussage nicht in `input/` oder in einer
   genannten Quelle, bleibt sie weg oder wird als offene Frage notiert (R-07).
4. **Personen- und Geschäftsgeheimnisse** bleiben draußen: keine Passwörter,
   Schlüssel, Kundendaten, unveröffentlichte Zahlen. `input/` wird mit committet.
5. **Rohe Dateien bleiben Rohtext.** Eine PowerPoint ist kein Webbauplan. Der
   Agent übersetzt sie in Inhalt, nicht in Dateiablage unter `public/`.

## Vorlage

`brief.md` in diesem Ordner ist die Vorlage für den Auftrag an den Agenten.
