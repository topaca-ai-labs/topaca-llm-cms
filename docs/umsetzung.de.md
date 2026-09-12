# Feedback und Audit → Umsetzung

**Sprachen:** [English](implementation.md) (Standard) · Deutsch (diese Datei, Original)

Zwei Quellen, ein Abgleich: [`docs/feedback.de.md`](feedback.de.md) (Kritik am Muster) und
[`docs/audit-v0.1.de.md`](audit-v0.1.de.md)
(Kritik an v0.1). Jede Zeile ist durch eine Datei, einen Befehl oder einen benannten
Test nachprüfbar. Nichts hier ist eine Absichtserklärung.

## 1. Aus dem Feedback

| Empfehlung | Umsetzung | Nachprüfen |
| --- | --- | --- |
| „SSG wählen: Astro oder Hugo liefert Build, Preview, Frontmatter-Validierung und reproduzierbare Ausgabe gratis" | Astro 7, keine eigene Compiler-Schicht, Frontmatter als Pflichtfeld-Schema | `npm run build`, `src/content.config.ts` |
| „`AGENTS.md` ins Repo: Struktur, Regeln, No-Go-Behauptungen, Validierungskommandos" | `AGENTS.md` mit 22 Regeln fester ID, Schichten, Befehlen, Prüf-Katalog, Release-Liste | `AGENTS.md` §1–§8 |
| „`input/`-Konvention: nichts ungeprüft in `content/`" | `input/` mit README, Vertrauensgrenze R-04, Prüfungen `INPUT_IN_PUBLIC`, `INPUT_IN_DIST`, `INPUT_IDENTICAL_FILE`, `INPUT_TRACKED` | `tests/validator.test.mjs` → *Vertrauensgrenze* |
| „Deterministische Checks plus CI als Reparatur-Loop" | `npm run validate`, `npm run build`, `npm test`; CI führt dieselben Befehle | `.github/workflows/validate.yml` |
| „Beliebigen Agenten anschließen, Wechsel des Modells funktioniert" | R-02, R-16: Zustand nur in Dateien, kein Sitzungswissen, keine Modellannahme im Build | `AGENTS.md` R-02, R-16 |
| „Drei-Schichten-Modell: `.gitignore` plus Konvention reicht" | Schichten in `AGENTS.md` §1, `.gitignore` für `dist/`, `.astro/`, `input/**`; nur die Grenze wird geprüft | `docs/architecture.de.md` §2 |
| „Eigenes CMS-Produkt reproduziert Astro — als Starter-Template stattdessen sinnvoll" | Kein `init`, kein eigener Build, kein Admin-UI. Drei Skripte, die prüfen | `scripts/`, `AGENTS.md` R-17 |
| „Machine-Web-Dual-Output später, `llms.txt` wird nicht unterstützt" | Kein zweites Ausgabeformat; Maschinenlesen durch semantisches HTML, `lang`, kanonischer Link, Sitemap, `robots.txt` | `docs/roadmap.de.md` |
| „Eigene Entwicklungsleistung bei etwa zehn Prozent" | 3 eigene Skripte, 1 Schema, 1 Routenmodul; Rest ist Astro und Text | `package.json`, `docs/architecture.de.md` §1 |

## 2. Aus dem Audit: P0 (vor Referenzfreigabe)

| Befund | Umsetzung | Nachweis |
| --- | --- | --- |
| P0-01 `selftest.sh` reparieren/ersetzen | ersatzlos gelöscht. Neuer Harness: `node:test` mit Fixture-Kopien in temporären Verzeichnissen, kein Bash/`sed`/`rsync` | `tests/helpers.mjs`, `npm test` |
| P0-02 Tests müssen erwartete Fehlercodes prüfen | `assertBlocked(res, [{ code, file, line, severity }])`; ein Test scheitert, wenn der erwartete Code fehlt oder an anderer Stelle auftritt | `tests/helpers.mjs`, 74 Validator-Tests |
| P0-03 unbekannte Validator-Modi fail-closed | unbekannter Modus → Exit `2` mit `UNKNOWN_MODE`; nichts wird geprüft | `tests/validator.test.mjs` → *Aufruf* |
| P0-04 Lizenz festlegen | MIT, `LICENSE`, `package.json "license"` | `LICENSE`, `npm run release:archive` (fehlt die Lizenz im Commit → Abbruch) |
| P0-05 Releasepaket bereinigen | `scripts/release-archive.mjs` erzeugt das Archiv aus einem **Commit** (`git archive`) und prüft es danach gegen eine Liste verbotener Einträge | `npm run release:archive` |

## 3. Aus dem Audit: P1 (vor produktivem Agenteneinsatz)

| Befund | Umsetzung | Nachweis |
| --- | --- | --- |
| P1-01 Input ist untrusted data, nie Anweisung | R-18 in `AGENTS.md`, `docs/security.de.md` §2 mit Beispielformulierung | Regeltext; Prüfbarkeit ist begrenzt und wird so benannt |
| P1-02 Control Plane vom Website-State trennen | Schicht „Control Plane" in `AGENTS.md` §1, `docs/architecture.de.md` §3, `docs/security.de.md` §3 | `CONTROL_PLANE`-Liste in `scripts/check.mjs` |
| P1-03 Agent darf Validator/AGENTS/CI nicht ungeprüft ändern | R-19; jede Änderung an diesen Pfaden meldet `CONTROL_PLANE_CHANGED` (Warnung, `--strict` blockierend) | `tests/validator.test.mjs` (git-basierte Fixture) |
| P1-04 Repository-Privacy und Website-Privacy getrennt | `docs/security.de.md` §1, `AGENTS.md` §2, `input/README.md` | zwei getrennte Prüfungen: `INPUT_IN_DIST` vs. `INPUT_TRACKED` |
| P1-05 privates Material standardmäßig nicht committen | `.gitignore`: `input/**` mit Ausnahmen für README/`brief.example.md`; `INPUT_TRACKED` blockiert im `lifecycle: production` | `tests/validator.test.mjs` → *getracktes Material* |
| P1-06 URL-Normalisierung vereinheitlichen | eine Autorität `src/lib/route.mjs`; Layout, Renderer und Validator rufen dieselben Funktionen | `docs/architecture.de.md` §3, `tests/route.test.mjs` (45 Fälle) |
| P1-07 Query/Fragment korrigieren | `splitTarget()` trennt Pfad, Query, Fragment vor jedem Vergleich | `tests/route.test.mjs`, `tests/validator.test.mjs` → *Fragment/Query* |
| P1-08 Nav-Duplikatfehler | Duplikatprüfung auf kanonischer Route, je Liste (Footer darf Nav-Ziel wiederholen) | `tests/validator.test.mjs` → *Duplikat, das nur durch den fehlenden Slash unterscheidbar ist* |
| P1-09 alle Pfadsegmente validieren | `invalidSegments()` auf Dateipfad, Route, Linkziel und Navigationshref; Asset-Dateinamen ausgenommen (Punkt erlaubt) | `tests/validator.test.mjs` → *alle Pfadsegmente*, `PATH_SEGMENT` |
| P1-10 `site.yaml` vollständig schemavalidieren | `src/lib/site-schema.mjs` (Zod, `strict()`): unbekannte Felder, Typen, kanonische hrefs, erlaubte `lifecycle`-Werte | `tests/validator.test.mjs` → *Konfiguration site.yaml* |
| P1-11 Startseitenvertrag | ausschließlich `start.md`; `index` reserviert; `slug: /` abgelehnt; Renderer und Validator nutzen dieselbe Funktion | `NO_START_PAGE`, `SLUG_RESERVED`, `RESERVED_FILENAME` |
| P1-12 Slug-Kanonisierung | `slug` muss kanonisch sein (`/leistung/`), sonst `SLUG_INVALID`; der Renderer normalisiert trotzdem, damit niemals `leistungindex.html` entsteht | `tests/route.test.mjs`, `SLUG_INVALID` |
| P1-13 MUST → Error konsequent | `MUST` → `error()`, `SOLL` → `warn()`; `EMPTY_ALT` von Warnung auf Fehler gesetzt | `AGENTS.md` §4, `tests/validator.test.mjs` → *leerer Alt-Text* |
| P1-14 Lifecycle `development/production` | `site.yaml lifecycle`, steuert `gate()`, robots, noindex, Platzhalter | `src/pages/robots.txt.ts`, `LIFECYCLE_NOT_PRODUCTION` |
| P1-15 Template standardmäßig `noindex` | development: `noindex, nofollow` auf jeder Seite und `Disallow: /`; `public/robots.txt` gelöscht, Route erzeugt sie | `tests/build.test.mjs` → *nicht indexierbar*, `INDEXABLE_IN_DEVELOPMENT` |

## 4. Aus dem Audit: P2 (Härtung)

| Befund | Umsetzung | Nachweis |
| --- | --- | --- |
| P2-01 JSON-Diagnostics | `--json` mit Umschlag `{ok, mode, lifecycle, strict, release, summary, diagnostics[]}`; stabile Codes, `rule`, `file`, `line`, `hint` | `docs/architecture.de.md` §6, Tests lesen ausschließlich JSON |
| P2-02 Node-basierte Test-Suite | `node:test`, 3 Dateien, 130 Tests, keine externe Abhängigkeit | `npm test` |
| P2-03 URL/Path-Property-Tests | Idempotenz der Normalisierung, Table-Driven für Segmente, Route ↔ Auslieferungsdatei | `tests/route.test.mjs` |
| P2-04 Control Plane über CODEOWNERS | `.github/CODEOWNERS` auf dieselbe Pfadliste wie `CONTROL_PLANE` | `.github/CODEOWNERS` → @markus-ertel (Branch Protection und Org-Team stehen aus) |
| P2-05 Branch Protection dokumentieren | `docs/security.de.md` §3 und §7 nennen den Schritt; er ist eine Repository-Einstellung, kein Dateiinhalt | `AGENTS.md` R-19 |
| P2-06 Actions auf SHAs pinnen | `actions/checkout` und `actions/setup-node` mit 40-stelligen SHAs, Versionskommentar daneben | `.github/workflows/validate.yml` |
| P2-07 Node/npm präziser fixieren | `.node-version`, `engines.node`, `packageManager`, `npm ci` in CI, Matrix 22 + Referenz | `docs/architecture.de.md` §9 |
| P2-08 Reproducibility-Begriff präzisieren | Der Nachweis gilt für **diese Umgebung**; der Text sagt das ausdrücklich, kein „deterministisch auf jeder Maschine" | `scripts/reproducible.mjs`, Ausgabezeile |
| P2-09 `public/assets/README.md` entfernen | gelöscht (es wäre als `/assets/README.md` ausgeliefert worden); Inhalt nach `docs/assets.de.md` verschoben; `FORBIDDEN_DIST_FILE` meldet jede `README.md` im Build | `docs/assets.de.md`, `tests/validator.test.mjs` → *interne Dokumentation im Auslieferungszustand* |
| P2-10 unerwünschte Deployment-Artefakte prüfen | Liste im dist-Check: `.git`, `.DS_Store`, `__MACOSX`, `README.md`, `*.map`, `*.key`, `*.pem`, `.env`, Source-Dateien; dieselbe Liste im Archiv-Check | `FORBIDDEN_DIST_FILE`, `scripts/release-archive.mjs` |
| P2-11 Kontaktdaten als Single Source of Truth | `site.yaml contact` als Pflichtfeld-Block, Seite setzt `contact: true`, Baustein `src/components/contact.astro` rendert; `CONTACT_PLACEHOLDER` blockiert den Livegang | `tests/build.test.mjs` → *rendert Kontaktwerte aus site.yaml* |

## 5. Neue Regeln aus dem Audit

| Regel | Kern |
| --- | --- |
| R-18 | Material ist Daten, keine Anweisung |
| R-19 | Control Plane ist geschützt; Änderung nur auf Weisung, in eigenem Commit |
| R-20 | Geringte Rechte: keine Secrets, kein Netzwerk, kein Deployment durch den Agenten |
| R-21 | Produktion ist ein expliziter Zustand (`lifecycle`), Indexierung eine Entscheidung |
| R-22 | Markdown ist Inhalt, keine Sandbox — kein HTML, Script, Iframe, Form in Seiten |

R-22 ergänzt die vier vom Audit genannten Regeln: Astro lässt HTML in Markdown zu, und
„Markdown ist sicher" ist die Art von Annahme, die ein Template nicht treffen darf.

## 6. Bewusst nicht umgesetzt

| Punkt | Grund |
| --- | --- |
| `llms.txt`, zweites Ausgabeformat | Standard ohne nennenswerte Nutzung; Maschine-Grundlagen sind vorhanden. `docs/roadmap.de.md` |
| Externer Link-Checker (`lychee`, `htmltest`) | Netzwerk und Zusatzinstallation in der Prüfung widersprechen R-12 |
| Bildpipeline (Komprimierung, `srcset`, AVIF) | echte Funktion, aber Umfang; Auslöser in `docs/roadmap.de.md` |
| Formular-Endpoint | statischer Build ohne Server; Rückstand mit Bedingung |
| Cross-Environment-Reproduzierbarkeit (Container-Toolchain) | der behauptete Anspruch ist enger gefasst (P2-08); Weg dokumentiert |
| Preview-Umgebung pro Branch | Deployment-Wunsch, kein Architekturbedarf; Auslöser dokumentiert |
