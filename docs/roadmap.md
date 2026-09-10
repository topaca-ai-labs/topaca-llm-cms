# Rückstand

Was diese Minimalvariante bewusst nicht enthält, warum nicht, und was der Auslöser wäre.
Jeder Punkt ist eine Entscheidung, kein Vergessen.

## Zurückgestellt, weil das Werkzeug den Nutzen nicht liefert

**`llms.txt` und zweites Ausgabeformat.** Das Muster beschreibt einen „Machine Web"-Ausgang
neben dem HTML. Der Standard dafür ist nicht verbreitet: Anbieter übernehmen ihn nicht, und
ein zweiter Ausgang verdoppelt die Build-Logik, ohne dass heute jemand davon liest.
Diese Website liefert stattdessen, was Maschinen tatsächlich auswerten: semantisches HTML,
`lang`, kanonische Links, Meta-Beschreibungen, Sitemap, `robots.txt`.
*Auslöser:* ein Auswerter, nachweislich davon profitiert.

**Externer Link-Checker (`lychee`, `htmltest`).** Prüft auch externe Ziele, braucht aber eine
Installation und macht die Prüfung vom Netzwerk abhängig. Der eingebaute Check prüft alles,
was im Repo liegen muss, offline und deterministisch.
*Auslöser:* häufige kaputte externe Ziele oder Anspruch auf Prüfung ausgehender Links.

## Zurückgestellt, weil der Bedarf noch nicht da ist

**Zweites Layout oder Komponenten.** Eine Seite, ein Layout, ein Stylesheet. Solange jede
Seite dieselbe Struktur hat, ist ein zweiter Rendering-Pfad nur eine zweite Möglichkeit,
etwas kaputt zu machen. *Auslöser:* Seitentyp mit anderer Struktur (Blog-Liste, Terminseite).

**Mehrsprachigkeit.** Das Muster nennt „neue Sprache hinzufügen" als Wartungsfall. Astro hat
dafür ein i18n-Konzept, das hier aber Navigation, URL-Schema, Checks und Inhalte gleichzeitig
anfasst. *Auslöser:* eine zweite Sprache mit echtem Publikum und geklärter Übersetzungsarbeit.

**Formulare, Kommentare, Suche.** Erfordern einen Server oder einen Drittdienst und damit
Datenschutz-Aussagen, die heute nicht getroffen sind. Kontakt läuft über `site.yaml`
(`contact:`). *Auslöser:* ein konkreter Kontaktweg mit Datenschutz-Freigabe.

**Bildoptimierung und Art Direction.** Keine Transformation, keine Größen, keine Formate.
Bilder liegen so in `public/assets/`, wie sie geliefert werden. *Auslöser:* Bilder größer als
der Seitentext oder ein echter Bedarf an responsiven Zuschnitten.

**Deployment-Workflows.** Kein Workflow für Pages, Netlify oder S3. Der Build ist eine
Schublade mit Dateien; die Wahl des Hosts ist noch nicht getroffen. *Auslöser:* Hosting-Entscheidung.

**Mehrere Agenten parallel.** Die Grenze `input/` und die Regel „eine Änderung pro Vorhaben"
tragen zwei bis drei Agenten. Sperrvermerke, Merge-Konfliktregeln für `site.yaml` und ein
Review-Zwang sind erst nötig, wenn tatsächlich Kollisionen auftreten. *Auslöser:* verlorene
Änderungen durch parallele Arbeit.

**Ordnung in `input/`.** Vier Ordner und Konvention. Kein Index, keine Verschlagwortung,
keine Vorschau auf PDFs. *Auslöser:* Materialbestand, der ohne Suche nicht mehr beherrschbar ist.

## Grundsätzliche Schwelle

Neue Abhängigkeiten, neue Skripte und neue Schichten brauchen einen Eintrag hier mit Auslöser —
und eine Antwort auf die Frage aus `docs/feedback.md`: *Lässt sich das nicht mit dem vorhandenen
Werkzeug als Konvention statt als Code lösen?*

## Nicht entschieden

**Lizenz.** Dieses Repository hat noch keine Lizenz. Bevor es öffentlich wird, braucht es eine.
Der Entwurf des Musters nennt Open Source als Haltung; die konkrete Wahl (MIT, Apache-2.0, CC
für Inhalte) ist eine Entscheidung des Besitzers, keine technische Vorentscheidung.
