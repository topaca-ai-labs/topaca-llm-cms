# Architektur

Referenzarchitektur der Minimalvariante. Die Auftragsgeschichte steht in
`docs/llm-cms.md`, die Kritik an v0.1 in `docs/feedback.md` und im Audit; dieses
Dokument beschreibt den Zustand, der daraus entstanden ist.

## 1. Wer was besitzt

| Aufgabe | Besitzer | Eigener Code |
| --- | --- | --- |
| Frontmatter-Schema im Build | Astro Content Layers (`src/content.config.ts`) | 23 Zeilen |
| Rendering, Routen, Assets | Astro | 0 Zeilen |
| Site-Metadaten | `site.yaml` + `src/lib/site-schema.mjs` | Schema |
| URL-Normalisierung | `src/lib/route.mjs` | eine Autorität |
| Prüfungen | `scripts/check.mjs` | ja |
| Wiederholbarkeitsnachweis | `scripts/reproducible.mjs` | ja |
| Release-Archiv | `scripts/release-archive.mjs` | ja |
| Regeln für Agenten | `AGENTS.md` | — |

Ein eigener Compiler, eine eigene CLI oder ein Admin-UI existieren bewusst nicht
(R-17). Der eigene Anteil ist klein, deterministisch und ohne Netzwerkzugriff.

## 2. Schichten

```text
input/          Rohtext, Vertrauensgrenze, standardmäßig nicht getrackt
   ↓ Agent überträgt Bedeutung, Mensch gibt frei
site.yaml       Name, Domain, Sprache, lifecycle, Navigation, contact
src/content/    Markdown-Seiten (Inhalt, kein HTML — R-22)
src/layouts/    ein Layout, eine Überschrift, robots-Meta aus lifecycle
src/components/ Kontakt-Baustein (SSoT aus site.yaml)
src/pages/      Routen: [...slug], index, sitemap.xml, robots.txt
public/         unveränderte Auslieferung (Assets, Favicon)
   ↓ astro build
dist/           wegwerfbar, niemals committet
```

## 3. Eine Autorität für URLs

`src/lib/route.mjs` ist die einzige Stelle, die aus einer Datei eine URL macht und
aus einem Link ein Dateiziel. Sie liefert:

| Funktion | Vertrag |
| --- | --- |
| `splitTarget(href)` | trennt Pfad, Query und Fragment — Query und Fragment sind nie Teil der Route |
| `canonical(path)` | kanonische Route oder `null`; idempotent, akzeptiert nur `a-z 0-9 - /` |
| `invalidSegments(path)` | Segmente, die gegen R-10 verstoßen (Großbuchstaben, Umlaute, Leerzeichen, `..`, Prozent) |
| `routeForPage(id, slug)` | Startseite ist `start.md` → `/`, sonst `/pfad/` |
| `outputFileFor(route)` | `/` → `index.html`, `/a/` → `a/index.html` |
| `isPagePath(path)` | Seite oder Asset |

Layout (`src/lib/page.ts`, `src/layouts/page.astro`), Renderer (`src/pages/*.astro`)
und Validator (`scripts/check.mjs`) rufen **dieselbe** Funktion auf. v0.1 hatte zwei
Routenlogiken: der Validator ließ `start.md` als Startseite gelten, der Renderer
brauchte `index.md`. Ein solcher Bruch ist damit strukturell ausgeschlossen, nicht
nur getestet.

`page.ts` ist TypeScript für Astro, `route.mjs` reines JavaScript — so können
Renderer und Validator denselben Code ohne Umdenken benutzen.

## 4. schema für site.yaml

`src/lib/site-schema.mjs` (Zod) lässt nur zu: `name`, `tagline`, `url`, `language`,
`lifecycle`, `nav`, `footer`, `contact`. `strict()` bedeutet: ein unbekanntes Feld ist
ein Fehler. Eine Navigation, die unter `navi:` steht, ist kein toter Konfigurationsteil,
sondern eine Diagnose (`SITE_YAML_INVALID`) — inklusive Pfad (`site.yaml → navi`).

Der Validator nutzt das geparste Objekt zusätzlich für Inhalte, die kein Schema
prüfen kann: Duplikate je Navigationsliste, Zielexistenz, Platzhalter-Domain,
Kontaktwerte. Bei Schemafehler wird mit dem rohen Wert weitergeprüft, damit ein
Fehler nicht die übrigen Befunde verdeckt; der Fehler bleibt stehen und blockiert.

## 5. Lebenszyklus

```text
lifecycle: development (Standard)   →  robots: Disallow: /   +  noindex auf jeder Seite
lifecycle: production                →  robots: Allow: / + Sitemap, keine noindex-Meta
```

Abgeleitet daraus: Schweregrade (`gate()`), Platzhalterbehandlung,
Kontaktplatzhalter, Indexierungsprüfungen. `npm run check:release` verlangt
`lifecycle: production` und meldet sonst `LIFECYCLE_NOT_PRODUCTION`.

## 6. Diagnosen

Eine Diagnose ist ein Datensatz, kein Textsatz:

```json
{
  "severity": "error",
  "code": "DEAD_INTERNAL_LINK",
  "rule": "R-08",
  "file": "src/content/pages/start.md",
  "line": 9,
  "target": "/gibt-es-nicht/",
  "message": "toter interner Link in Zeile 9: /gibt-es-nicht/",
  "hint": "Seite anlegen, Link entfernen oder Ziel korrigieren"
}
```

`--json` liefert den Umschlag:

```json
{ "ok": false, "mode": "source", "lifecycle": "development",
  "strict": false, "release": false,
  "summary": { "errors": 1, "warnings": 3, "notes": 1 },
  "diagnostics": [ … ] }
```

Regeln dafür:

- **Code-Namen sind stabil.** `SCREAMING_SNAKE`, kein `E-`/`W-`-Präfix (die Schwere
  steht im eigenen Feld), nie umnummeriert, nie ohne Regelbezug.
- **`rule`** verweist auf `AGENTS.md`; eine Diagnose ohne Regel ist eine Meinung.
- **`line`/`target`** gehören dazu, wenn die Stelle bekannt ist — Tests prüfen sie.
- **`hint`** ist die Reparatur, nicht die Wiederholung des Befundes.
- Exit-Codes: `0` in Ordnung, `1` blockiert, `2` fehlerhafter Aufruf. Ein unbekannter
  Modus ist `2` mit `UNKNOWN_MODE` — prüfen können heißt nicht durchlassen (fail-closed).

## 7. Prüfmodelle

| Modus | Frage | Blockiert bei |
| --- | --- | --- |
| `source` | ist der Zustand konsistent? | MUST-Verletzungen |
| `dist` | ist die Ausgabe korrekt? | MUST-Verletzungen |
| `--strict` | zusätzlich: sind die SOLL-Vorgaben erfüllt? | auch Warnungen |
| `--release` | ist das ein Livegang? | auch `lifecycle: development`, Platzhalter, Kontaktlücken |

## 8. Testschichten

| Schicht | Datei | Beweis |
| --- | --- | --- |
| Einheiten | `tests/route.test.mjs` | URL-Normalisierung, Segmente, Idempotenz, reserviertenamen |
| Contract | `tests/validator.test.mjs` | jede Regel hat einen Fehlerfall mit Code, Datei, Zeile |
| Integration | `tests/build.test.mjs` | echter Astro-Build, dist-Check, Template nicht indexierbar, Kontakt aus `site.yaml` |

Fixtures sind echte Projektkopien in einem temporären Verzeichnis
(`tests/fixtures/base`), nicht mit `sed` verbogene Text. Jeder Test ist unabhängig,
keine Reihenfolge, kein geteiltes Verzeichnis. Der Harness ist `node:test` — ohne
Bash, ohne `mktemp`, ohne Dialekte. Ein Test, der nur "Exit ungleich 0" prüft, gilt
als unzureichend: erwartet wird der benannte Befund.

## 9. Umgebung

Reproduzierbarkeit braucht eine fixierte Umgebung, sonst ist der Nachweis eine
Aussage über den Zufall.

| Fixiert durch | Wert |
| --- | --- |
| Node | `.node-version` (Referenz), `engines.node >= 22.12` |
| npm | `packageManager` in `package.json` |
| Abhängigkeiten | `package-lock.json`, CI mit `npm ci` |
| CI-Aktionen | SHA-pinning in `.github/workflows/validate.yml` |

`npm run reproducible` vergleicht zwei Builds **in dieser Umgebung** und sagt das
auch im Text. Cross-Environment-Reproduzierbarkeit (anderes Betriebssystem, andere
Node-Version, Build in drei Jahren) ist nicht behauptet; der Weg dorthin wäre ein
Container-Image mit exakter Toolchain — Rückstand in `docs/roadmap.md`.

## 10. Entscheidungen und ihre Gründe

| Entscheidung | Grund | Alternative, verworfen |
| --- | --- | --- |
| Astro statt Hugo | Content-Layer-Schema im Build, Node vorhanden, keine Extrawerkzeugkette | Hugo (mehr Installation, kein Schema), eigener Compiler (R-17) |
| `start.md` als einzige Startseite | eine Startseite, keine zwei Wahrheiten | `index.md` (Astro-Konvention) — kollidiert mit `src/pages/index.astro` |
| YAML statt `astro:config`-JSON | Menschen lesen und agenten editieren es sauber | `astro.config.ts` (Code als Konfiguration) |
| eigene Prüfungen statt `lychee`/`htmltest` | kein Netzwerk, keine Zusatzinstallation, deterministisch | externe Linkprüfer (Netzwerk im Build, R-12) |
| `input/` standardmäßig ignoriert | Repository-Grenze ist die teurere Grenze | mitcommitten (veröffentlicht Rohtext) |
| Tests in `node:test` | kein Runner, keine Bash-Abhängigkeit, Codes prüfbar | Bash- Selbsttest (v0.1: False Positives, keine Codes) |
| eine URL-Autorität | Renderer und Validator können nicht auseinanderlaufen | doppelte Logik (v0.1-Fehler) |

## 11. Was diese Architektur nicht ist

Kein CMS-Produkt, keine Mehrmandantenfähigkeit, kein Login, keine Workflow-Engine,
kein Preview-Server, keine Datenbank, kein Publishing über API. Die Begründung und
die Bedingungen für jede Ergänzung: `docs/roadmap.md`.
