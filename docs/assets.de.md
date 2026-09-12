# Assets

**Sprachen:** [English](assets.md) (Standard) · Deutsch (diese Datei, Original)

`public/assets/` ist der Ort für veröffentlichte Assets: Bilder, PDFs, Schriften.

`public/` wird von Astro unverändert in den Build übernommen. Was hier liegt,
ist also öffentlich — unter dem gleichen Pfad, den die Website ausliefert.

## Übernahme aus `input/`

Material aus `input/` landet **nicht** automatisch hier. Übernahme ist ein
eigener Schritt (AGENTS.md R-04):

1. Das Material ansehen: Was ist es? Wem gehört es? Ist es zur Veröffentlichung
   gedacht?
2. Bei Bedarf aufbereiten: zugeschnitten, komprimiert, sprechender Dateiname,
   keine eingebetteten Metadaten aus Fremdsystemen (`docs/roadmap.de.md` nennt
   Bildaufbereitung als bewussten Rückstand — hier entscheidet der Mensch).
3. Übernehmen und im Commit-Message belegen, aus welchem `input/`-Ordner die
   Datei stammt und warum sie öffentlich sein darf (R-07).

Der Validator meldet zwei Dinge:

- `INPUT_IN_PUBLIC` — ein Ordner wie `public/input/` existiert, also Material
  wurde unverändert in den Auslieferungsbereich gelegt.
- `INPUT_IDENTICAL_FILE` — eine Datei hier ist byte-identisch mit einer Datei in
  `input/`. Das ist ein Hinweis zur Bestätigung, kein Verdacht. Er erkennt nur
  vollständig identische Dateien; eine geänderte Zeile entgeht ihm. Er ist keine
  Datenlecksuche (siehe `docs/security.de.md`).

## Keine Dokumentation in `public/`

`README.md`-Dateien in `public/` werden mit ausgeliefert und sind dann über die
Website lesbar. Interne Hinweise gehören in `docs/`. Der Build-Check meldet jede
`README.md` im Auslieferungszustand als `FORBIDDEN_DIST_FILE` (R-03).
