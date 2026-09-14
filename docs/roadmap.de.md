# Rückstand

**Sprachen:** [English](roadmap.md) (Standard) · Deutsch (diese Datei, Original)

Was diese Minimalvariante bewusst nicht enthält, warum nicht, und was der Auslöser wäre.
Jeder Punkt ist eine Entscheidung, kein Vergessen.

## Zurückgestellt, weil das Werkzeug den Nutzen nicht liefert

**`llms.txt` und zweites Ausgabeformat.** Das Muster beschreibt einen „Machine Web"-Ausgang
neben dem HTML. Der Standard dafür ist nicht verbreitet: Anbieter übernehmen ihn nicht, und
ein zweiter Ausgang verdoppelt die Build-Logik, ohne dass heute jemand davon liest.
Diese Website liefert stattdessen, was Maschinen tatsächlich auswerten: semantisches HTML,
`lang`, kanonische Links, Meta-Beschreibungen, Sitemap, `robots.txt` aus dem Lebenszyklus.
*Auslöser:* ein Auswerter, nachweislich davon profitiert.

**Externer Link-Checker (`lychee`, `htmltest`).** Prüft auch externe Ziele, braucht aber eine
Installation und macht die Prüfung vom Netzwerk abhängig. Der eingebaute Check prüft alles,
was im Repo liegen muss, offline und deterministisch.
*Auslöser:* häufige kaputte externe Ziele oder Anspruch auf Prüfung ausgehender Links.

**Cross-Environment-Reproduzierbarkeit.** `npm run reproducible` vergleicht zwei Builds in
derselben Umgebung (`.node-version`, `packageManager`, Lockfile) und sagt das auch. Ein
anspruchsvollerer Beweis braucht ein festes Container-Image mit exakter Toolchain und einen
Hashvergleich über Betriebssysteme hinweg — ein eigenes Thema, kein Textfehler.
*Auslöser:* zwei Umgebungen, deren Builds sich unterscheiden und bei denen das zählen muss.

## Zurückgestellt, weil der Bedarf noch nicht da ist

**Zweites Layout oder Komponenten.** Eine Seite, ein Layout, ein Stylesheet, ein
Kontakt-Baustein. Solange jede Seite dieselbe Struktur hat, ist ein zweiter Rendering-Pfad
nur eine zweite Möglichkeit, etwas kaputt zu machen. *Auslöser:* Seitentyp mit anderer
Struktur (Blog-Liste, Terminseite).

**Mehrsprachigkeit.** Das Muster nennt „neue Sprache hinzufügen" als Wartungsfall. Astro hat
dafür ein i18n-Konzept, das hier aber Navigation, URL-Schema, Checks und Inhalte gleichzeitig
anfasst. *Auslöser:* eine zweite Sprache mit echtem Publikum und geklärter Übersetzungsarbeit.

**Formulare, Kommentare, Suche.** Erfordern einen Server oder einen Drittdienst und damit
Datenschutz-Aussagen, die heute nicht getroffen sind. Kontakt läuft über `site.yaml`
(`contact:`) und wird von Seiten mit `contact: true` gerendert. *Auslöser:* ein konkreter
Kontaktweg mit Datenschutz-Freigabe.

**Bildoptimierung, Art Direction, Metadatenbereinigung.** Keine Transformation, keine Größen,
keine Formate, kein EXIF-Entfernen. Bilder liegen so in `public/assets/`, wie sie übergeben
werden — inklusive der Metadaten, die ein Foto tragen kann. *Auslöser:* Bilder größer als der
Seitentext, Bedarf an Zuschnitten, oder Material aus Quellen mit eingebetteten Ortsdaten.

**Deployment-Workflows und Vorschau pro Branch.** Kein Workflow für Pages, Netlify oder S3,
keine Deploy-Preview pro Pull Request. Der Build ist eine Schublade mit Dateien; die Wahl des
Hosts ist offen, und Deployment ist absichtlich ein eigener Schritt (R-20).
*Auslöser:* Hosting-Entscheidung.

**Code-Owner-Review als Sperre.** Die Branch Protection auf `main` ist gesetzt: drei
vorgeschriebene Status-Checks, Pull Request vor Merge, kein Force-Push, kein Löschen.
`CODEOWNERS` (Inhaber: @markus-ertel) und die Warnung `CONTROL_PLANE_CHANGED` gibt es, aber
„Require review from code owners" bleibt bewusst aus: Die Organisation hat noch kein Team,
eine Organisation ist in `CODEOWNERS` kein gültiger Inhaber, und mit einem einzelnen Inhaber,
der zugleich Autor ist, würde die Flagge die eigenen Merges blockieren. `enforce_admins` ist
ebenfalls aus, der Inhaber darf also weiter direkt pushen. *Auslöser:* ein Team unter
@topaca-ai-labs — dann nennt `CODEOWNERS` das Team, die Flagge geht an, und `enforce_admins`
wäre eine Entscheidung statt einer Notwendigkeit.

**Verschattung der Prüfungen (Mutation Testing).** Der Test-Harness beweist, dass jede Regel
ihren Fehlerfall erwischt. Ein Werkzeug, das mutierte Validator-Versionen gegen die Tests
laufen lässt, würde die Lücke zeigen, die eine Testliste trotzdem lässt.
*Auslöser:* eine Regel, die trotz Testfall versagt.

**Mehrere Agenten parallel.** Die Grenze `input/` und die Regel „eine Änderung pro Vorhaben"
tragen zwei bis drei Agenten. Sperrvermerke, Merge-Konfliktregeln für `site.yaml` und ein
Review-Zwang sind erst nötig, wenn tatsächlich Kollisionen auftreten. *Auslöser:* verlorene
Änderungen durch parallele Arbeit.

**Ordnung in `input/`.** Vier Ordner und Konvention. Kein Index, keine Verschlagwortung,
keine Vorschau auf PDFs. *Auslöser:* Materialbestand, der ohne Suche nicht mehr beherrschbar ist.

**Sprache der Diagnose-Meldungen.** Codes, Regel-IDs und Dateipfade sind sprachneutral; die
Meldungstexte, die der Validator druckt, sind Deutsch. Eine Übersetzung ändert die Ausgabe jeder
Prüfung und die Erwartungswerte jedes Tests — genau die Art Änderung, die R-19 einer
ausdrücklichen Weisung vorbehält. *Auslöser:* ein Nutzer, der Diagnosen auf Englisch liest —
dann als umschaltbare Locale (Standard `en`), nie als Abzweigung der Meldungsliste.

## Entschieden (und warum es dabei bleibt)

| Frage | Entscheidung |
| --- | --- |
| Astro oder Hugo | Astro — Content-Layer-Schema im Build, Node-Umgebung vorhanden |
| Lizenz und Inhaberschaft | MIT (`LICENSE`) auf das ganze Repository, Code und Texte; Copyright © 2026 Markus Ertel, TOPACA AI Labs — durchgängig ein Autor, es fehlt also keine Erlaubnis Dritter |
| Startseite | ausschließlich `start.md`; `index` reserviert, `slug: /` abgelehnt |
| `input/` im Repository | standardmäßig nicht getrackt (`input/**`), Ausnahmen nur README und Brief-Vorlage |
| Schweregrade | `MUST` → Fehler, `SOLL` → Warnung; `--strict` hebt Warnungen auf Blockadestufe |
| Indexierung | im `lifecycle: development` immer gesperrt; Livegang verlangt `lifecycle: production` |
| Markdown in Inhalten | verboten (R-22), weil Astro HTML durchlässt und Markdown keine Sandbox ist |

## Grundsätzliche Schwelle

Neue Abhängigkeiten, neue Skripte und neue Schichten brauchen einen Eintrag hier mit Auslöser —
und eine Antwort auf die Frage aus `docs/feedback.de.md`: *Lässt sich das nicht mit dem vorhandenen
Werkzeug als Konvention statt als Code lösen?*
