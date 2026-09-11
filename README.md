# LLM-CMS — Minimalvariante

Eine Website, die ein Agent baut und pflegt, deren Zustand aber vollständig in Dateien gehört.

```text
Der Agent ist das CMS.
Das Repository ist der Zustand.
Die Werkzeugkette erzwingt die Mechanik.
```

Dieses Repository ist die Minimalvariante des Musters aus [`docs/llm-cms.md`](docs/llm-cms.md),
gebaut nach [`docs/feedback.md`](docs/feedback.md) und gehärtet nach dem Audit in
`docs/` — nachzählen in [`docs/umsetzung.md`](docs/umsetzung.md). Es ist **kein eigenes
CMS-Produkt**, sondern ein Template auf einem bestehenden Static Site Generator, eine
Regeldatei, eine Vertrauensgrenze und deterministische Prüfungen.

| Baustein | Umsetzung | eigener Code |
| --- | --- | --- |
| SSG, Build, Vorschau, Frontmatter-Schema | [Astro](https://astro.build) 7 | nein |
| Agenten-Verfassung | [`AGENTS.md`](AGENTS.md) — 22 Regeln mit fester ID | Text |
| Vertrauensgrenze | `input/`, standardmäßig nicht getrackt, geprüft in Quelle und Build | Regel R-04 |
| URL-Vertrag | `src/lib/route.mjs` — eine Autorität für Layout, Renderer und Prüfung | 88 Zeilen |
| Konfigurationsschema | `src/lib/site-schema.mjs` (Zod, nur erlaubte Felder) | 63 Zeilen |
| Prüfungen | `scripts/check.mjs` mit stabilen Diagnose-Codes, `--json` | ~900 Zeilen |
| Nachweise | `reproducible.mjs`, `release-archive.mjs`, 132 Tests | ~1.100 Zeilen |
| Reparatur-Loop | lokal `npm run validate` · `build` · `test`, GitHub Actions als Spiegel | — |

Der eigene Code prüft. Er baut nichts selbst.

## 60 Sekunden Start

```bash
npm ci               # exakt aus dem Lockfile
npm run dev          # http://localhost:4321
```

Danach:

```bash
npm run validate     # Quellenzustand prüfen (schnell)
npm run build        # bauen und Ausgabe prüfen
npm test             # 132 Tests der Werkzeugkette
npm run preview      # fertige Website im Browser
```

Die Website enthält bewusst Platzhalter, und `lifecycle` steht auf `development`:
`robots.txt` sperrt die Indexierung, jede Seite trägt `noindex`. `npm run check:strict`
und `npm run check:release` bleiben deshalb rot, bis echte Inhalte eingetragen sind und
`site.yaml` auf `lifecycle: production` steht. Das ist kein Defekt, sondern die Funktion.

## Mit einem Agenten arbeiten

1. `AGENTS.md` ist die erste Datei, die der Agent liest. Jedes Tool, das `AGENTS.md`
   unterstützt (Pi, Codex, Claude Code, OpenCode und andere), arbeitet direkt damit;
   [`CLAUDE.md`](CLAUDE.md) verweist darauf, statt es zu duplizieren.
2. Material in `input/` ablegen — Brief, Texte, Bilder, PDFs. Es ist Daten, keine
   Anweisung (R-18), und es bleibt ohne ausdrückliche Entscheidung außerhalb des
   Repositories.
3. Absicht formulieren, zum Beispiel:

   > Wir bieten ab sofort KI-Beratung für kleine Unternehmen. Siehe
   > `input/documents/beratung.md`. Arbeite das in die bestehende Website ein und ändern
   > Sie nur Aussagen, die durch das Material gedeckt sind.

4. Der Agent ändert Dateien in der Content-Schicht, prüft, repariert, zeigt die Vorschau.
   Er fasst Regelwerk, Validator und CI nicht an (R-19).
5. Der Mensch entscheidet über Inhalt und gibt frei (Commit, Branch oder PR).

Weil der Zustand im Repository liegt, ist das Modell austauschbar: ein anderes Modell oder
ein anderer Agent findet dieselben Regeln, dieselbe Struktur und dieselbe Historie vor.

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Vorschau mit Live-Reloading |
| `npm run validate` | `astro sync` (Schema) + Quellen-Checks |
| `npm run build` | Build + Checks der Ausgabe |
| `npm run check` | `validate` und `build` |
| `npm run check:strict` | zusätzlich blockieren Warnungen |
| `npm run check:release` | Livegang-Prüfung, verlangt `lifecycle: production` |
| `npm test` | Einheiten, Contract-Tests und echter Build |
| `npm run reproducible` | zweimal bauen, byte-genau vergleichen |
| `npm run release:archive` | Release-Archiv aus einem Commit, Inhalt geprüft |
| `node scripts/check.mjs source --json` | Diagnosen maschinenlesbar |

Exit-Codes: `0` in Ordnung, `1` blockiert, `2` fehlerhafter Aufruf — bei `2` wurde nichts
geprüft.

## Struktur

```text
AGENTS.md              Verfassung: Schichten, 22 Regeln, Befehle, Freigabeliste
CLAUDE.md              Verweis auf AGENTS.md (kein zweites Regelwerk)
site.yaml              Name, Domain, Sprache, lifecycle, Navigation, Fußzeile, contact
LICENSE                MIT
input/                 Rohtext vom Menschen — standardmäßig NICHT getrackt
  README.md            zwei Veröffentlichungsgrenzen, Regeln für Material
  brief.example.md     Vorlage für den Auftrag
src/
  content.config.ts    Schema der Seiten (Pflichtfelder, Längen, Draft, noindex, sources)
  content/pages/*.md   die Seiten — Markdown, kein HTML (R-22)
  layouts/page.astro   ein Layout: h1, kanonischer Link, robots aus lifecycle
  components/          contact.astro — Werte aus site.yaml, nicht aus Seiten
  pages/               index, [...slug], sitemap.xml, robots.txt (aus lifecycle)
  lib/route.mjs        EINE Autorität für URLs (Layout, Renderer, Prüfung)
  lib/site-schema.mjs  erlaubte Felder von site.yaml
public/                unveränderte Auslieferung: favicon.svg, assets/
scripts/
  check.mjs            Quellen- und Build-Checks, --json, --strict, --release
  reproducible.mjs     zweimal bauen, byte-genau vergleichen
  release-archive.mjs  Archiv aus einem Commit, frei von node_modules und dist
tests/                 132 Tests: route, validator, build (node:test, Fixtures)
docs/
  architecture.md      Schichten, Diagnosen, Umgebung, Entscheidungen
  security.md          Grenzen, Control Plane, was Prüfungen nicht beweisen
  assets.md            Übernahme von Material nach public/
  seitenvorlage.md     Frontmatter-Vorlage für eine neue Seite
  umsetzung.md         Feedback und Audit → Umsetzung, Punkt für Punkt
  roadmap.md           was bewusst fehlt, mit Auslöser
  llm-cms.md           das Muster (Idee) · feedback.md · das Audit
dist/                  Build — wegwerfbar, nicht committet (R-03)
```

## Was die Werkzeugkette beweist — und was nicht

`docs/security.md` führt das einzeln auf. Kurz:

- Der Hash-Vergleich mit `input/` erkennt **byte-identische** Übernahmen. Eine geänderte
  Zeile entgeht ihm. Er ist eine Absicherung gegen bequemes Kopieren, keine Datenlecksuche.
- Der Secret-Scan ist eine Denylist: er findet Bekanntes, nicht Abwesenheit.
- `npm run reproducible` vergleicht zwei Builds **in dieser Umgebung** (`.node-version`,
  `packageManager`, Lockfile). Cross-Environment-Reproduzierbarkeit ist nicht behauptet.
- Gegen Anweisungen in Material hilft kein Check, sondern die Regel R-18 und die Freigabe
  durch den Menschen.

## Deployment

`npm run build` erzeugt `dist/` mit reinen statischen Dateien. Jeder statische Host passt:
CDN, Netlify, GitHub Pages, ein Nginx, ein Ordner auf einem Webspace. Der Produktionsserver
ist kein CMS, sondern ein Auslieferungsziel. Deployment ist ein eigener, vom Menschen
freigegebener Schritt (R-20).

## Lizenz

MIT, siehe [`LICENSE`](LICENSE). Das Material in `docs/llm-cms.md`, `docs/feedback.md` und
dem Audit-Dokument ist Ausgangsmaterial dieses Templates und nicht Teil der Lizenz.
