# LLM-CMS — Minimalvariante

Eine Website, die ein Agent baut und pflegt, deren Zustand aber vollständig in Dateien gehört.

```text
Der Agent ist das CMS.
Das Repository ist der Zustand.
Die Werkzeugkette erzwingt die Mechanik.
```

Dieses Repository ist die Minimalvariante des Musters aus [`docs/llm-cms.md`](docs/llm-cms.md),
gebaut nach [`docs/feedback.md`](docs/feedback.md): **kein eigenes CMS-Produkt**, sondern ein
Template auf einem bestehenden Static Site Generator, eine Regeldatei, eine Vertrauensgrenze
und deterministische Prüfungen.

| Baustein | Umsetzung | eigener Code |
| --- | --- | --- |
| SSG, Build, Vorschau | [Astro](https://astro.build) 7 | nein |
| Inhalts-Schema, Validierung | Astro Content Layers + Zod (`src/content.config.ts`) | 25 Zeilen Schema |
| Agenten-Verfassung | [`AGENTS.md`](AGENTS.md) | Text |
| Vertrauensgrenze | `input/` + Regel R-04 + Prüfung im Check | — |
| Zustand und Historie | Git | nein |
| Deterministische Checks | `scripts/check.mjs` | ~415 Zeilen |
| Reparatur-Loop | `npm run check` lokal, GitHub Actions als Spiegel | — |

Der eigene Code prüft, baut nichts selbst: 415 Zeilen Checks, 56 Zeilen Reproduzierbarkeits-
nachweis, 192 Zeilen Selbsttest, 23 Zeilen Schema. Alles andere ist Astro und Konvention.

## 60 Sekunden Start

```bash
npm install
npm run dev          # http://localhost:4321
```

Danach:

```bash
npm run validate     # Quellenzustand prüfen (schnell)
npm run build        # bauen und Ausgabe prüfen
npm run preview      # fertige Website im Browser
```

Die Website enthält bewusst Platzhalter. `npm run check:strict` bleibt deshalb rot, bis echte
Inhalte eingetragen sind. Das ist kein Defekt, sondern die Funktion.

## Mit einem Agenten arbeiten

1. `AGENTS.md` ist die erste Datei, die der Agent liest. Jedes Tool, das `AGENTS.md`
   unterstützt (Pi, Codex, Claude Code, OpenCode und andere), arbeitet direkt damit.
2. Material in `input/` ablegen — Brief, Texte, Bilder, PDFs.
3. Absicht formulieren, zum Beispiel:

   > Wir bieten ab sofort KI-Beratung für kleine Unternehmen. Siehe
   > `input/documents/beratung.md`. Arbeite das in die bestehende Website ein und ändern
   > Sie nur Aussagen, die durch das Material gedeckt sind.

4. Der Agent ändert Dateien, prüft mit `npm run check`, repariert, zeigt die Vorschau.
5. Der Mensch entscheidet über Inhalt und gibt frei (Commit, Branch oder PR).

Weil der Zustand im Repository liegt, ist das Modell austauschbar: ein anderes Modell oder ein
anderer Agent findet dieselben Regeln, dieselbe Struktur und dieselbe Historie vor.

## Struktur

```text
AGENTS.md              Verfassung: Regeln, Workflow, Befehle
site.yaml              Name, Domain, Sprache, Navigation, Fußzeile
input/                 Rohtext vom Menschen — nie ungeprüft öffentlich
  brief.md             Vorlage für den Auftrag
src/
  content.config.ts    Schema der Seiten (Pflichtfelder, Längen, Draft, noindex)
  content/pages/*.md   die Seiten
  layouts/page.astro   ein Layout für alle Seiten
  pages/               index.astro, [...slug].astro, sitemap.xml.ts
  styles/global.css    ein Stylesheet, Tokens in :root
  lib/                 site.yaml laden, URL einer Seite ableiten
public/
  assets/              veröffentlichte Assets (nur nach Prüfung)
  favicon.svg, robots.txt
scripts/
  check.mjs            Quellen- und Build-Checks
  reproducible.mjs     zweimal bauen, byte-genau vergleichen
  selftest.sh          Negativtests: erwischen die Checks ihre Fehlerfälle?
docs/
  llm-cms.md           das Muster (Idee)
  feedback.md           die Kritik, die diese Variante bestimmt
  umsetzung.md         Feedback → Umsetzung, Punkt für Punkt
  roadmap.md            was bewusst fehlt und warum
dist/                  Build — wegwerfbar, nicht committet
```

## Deployment

`npm run build` erzeugt `dist/` mit reinen statischen Dateien. Jeder statische Host passt:
CDN, Netlify, GitHub Pages, ein Nginx, ein Ordner auf einem Webspace. Der Produktionsserver
ist kein CMS, sondern ein Auslieferungsziel.

## Nach der Änderung an der Werkzeugkette

```bash
npm run reproducible   # Determinismus
npm run selftest       # Negativtests (aktuell 27) der Checks
```

## Lizenz und offene Punkte

Über die Lizenz dieses Templates ist noch nicht entschieden worden (siehe `docs/roadmap.md`).
Der Ordner `docs/` enthält das ursprüngliche Muster-Dokument und sein Feedback; beide sind
Ausgangsmaterial, keine Projektion dieses Templates.
