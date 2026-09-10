# Feedback → Umsetzung

Abgleich von [`docs/feedback.md`](feedback.md) mit diesem Repository. Jede Zeile ist über einen
Befehl oder eine Datei nachprüfbar.

| Empfehlung aus dem Feedback | Umsetzung | Nachprüfen |
| --- | --- | --- |
| „SSG wählen: Astro oder Hugo liefert Build, Preview, Frontmatter-Validierung und reproduzierbare Ausgabe gratis" | Astro 7, keine eigene Compiler-Schicht. Frontmatter-Schema als Pflichtfelder | `npm run build`, `src/content.config.ts` |
| „`AGENTS.md` ins Repo: Struktur, Regeln, No-Go-Behauptungen, Validierungskommandos" | `AGENTS.md` mit 17 Regeln fester ID, Befehlstabelle, Prüf-Katalog, Release-Liste | `AGENTS.md` §3, §4, §5, §6 |
| „`input/`-Konvention: Ordner anlegen und festlegen, dass nichts ungeprüft in `content/` wandert" | `input/` mit README und Brief-Vorlage; Regel R-04; der Check meldet Material aus `input/` im Auslieferungsbereich und im fertigen Build | `node scripts/check.mjs source`, `node scripts/check.mjs dist` |
| „Deterministische Checks plus CI als Reparatur-Loop für den Agenten" | `npm run validate` (Quellen) und `npm run build` (Ausgabe), GitHub-Actions-Workflow als Spiegel desselben Standes | `.github/workflows/validate.yml` |
| „Beliebigen Agenten anschließen, Wechsel des Modells funktioniert, weil der Zustand im Repo liegt" | Regel R-02 und R-16: kein Sitzungswissen, keine Modellannahmen, keine Laufzeitabhängigkeit vom Modell | `AGENTS.md` R-02, R-16 |
| „Drei-Schichten-Modell: `.gitignore` plus Konvention reicht, kein eigenes Enforcement-Tool" | `.gitignore` für `dist/` und `.astro/`, Schichtentabelle in `AGENTS.md` §1; der Check prüft nur die Grenze, nicht den Inhalt | `.gitignore`, `AGENTS.md` §1 |
| „Eigenes CMS-Produkt mit eigener CLI reproduziert Astro — als Starter-Template stattdessen sinnvoll" | Kein `init`, kein eigener Build, kein Admin-UI. Drei Skripte, die prüfen statt bauen | `scripts/`, `AGENTS.md` R-17 |
| „Machine-Web-Dual-Output auf später verschieben, `llms.txt` wird nicht unterstützt" | Kein zweites Ausgabeformat. Stattdessen das, was Maschinen heute lesen: sauberes HTML, `lang`, kanonischer Link, Sitemap, `robots.txt` | `src/layouts/page.astro`, `src/pages/sitemap.xml.ts`, `docs/roadmap.md` |
| „Die eigene Entwicklungsleistung sollte bei etwa zehn Prozent liegen" | 2 Abhängigkeiten, 3 Skripte, 1 Schema. Rest ist Astro und Text | `package.json` |

## Was über das Feedback hinausgeht — und warum

| Zusatz | Begründung |
| --- | --- |
| `scripts/check.mjs` (415 Zeilen) | Das Feedback nennt Link-Check als Standardbaustein. Ein externer Link-Checker (`lychee`, `htmltest`) braucht eine Installation und zieht Netzwerk in die Prüfung. Ein Skript ohne Abhängigkeiten läuft überall und bleibt deterministisch. |
| Vertrauensgrenze als Prüfung, nicht nur als Text | Der teuerste denkbare Fehler ist veröffentlichtes Rohtext-Material. Hash-Vergleich `input/` ↔ Auslieferung ist sechs Zeilen Code und schließt die Lücke mechanisch. |
| `scripts/reproducible.mjs` | Der Kernsatz des Musters ist „zweimal bauen, gleiches Ergebnis". Ohne Nachweis ist es eine Behauptung. |
| `scripts/selftest.sh` | Eine Sicherheitskette, die niemand getestet hat, ist eine Vermutung. Negativfälle (aktuell 27) beweisen, dass die Checks greifen. |

## Bewusst nicht umgesetzt

Zwei Empfehlungen des Feedbacks sind Entscheidung, nicht Übersehen:

- **Astro statt Hugo.** Beide wären korrekt. Astro ist gewählt, weil Node im Umfeld vorhanden
  ist, die Content Layers das Schema ohne Zusatzwerkzeug erzwingen und `site.yaml` ohne
  Codegen-Schritt direkt in den Build gelesen wird.
- **Kein `llms.txt` und kein zweites Ausgabeformat**, obwohl das Muster es beschreibt. Das
  Feedback begründet die Zurückstellung; `docs/roadmap.md` hält den Punkt offen.
