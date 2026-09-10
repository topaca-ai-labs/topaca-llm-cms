# AGENTS.md — Verfassung dieser Website

Diese Datei ist der Arbeitsvertrag für jeden Agenten, der an dieser Website arbeitet.
Sie ist bewusst kurz: alles, was hier nicht steht, ist entweder Absicht in `docs/llm-cms.md`
oder muss im Repo nachgelesen werden, bevor gehandelt wird.

```text
Der Mensch gibt Absicht und Material.
Der Agent handled Bedeutung.
Das Repository hält den Zustand.
Die Werkzeugkette erzwingt Mechanik.
Der Build ist wegwerfbar.
```

Der Mensch entscheidet über Inhalt und Positionierung. Der Agent entscheidet über
Mechanik, Kohärenz und Sauberkeit — und schlägt vor, statt still zu ändern.

## 1. Schichten

| Schicht | Ort | Regel |
| --- | --- | --- |
| Input (Rohtext, Mensch) | `input/` | nur lesen, nie ungeprüft veröffentlichen |
| Kanonischer Zustand | `site.yaml`, `src/content/`, `src/layouts/`, `src/styles/`, `public/assets/`, `AGENTS.md` | die einzige Wahrheit über die Website |
| Build | `dist/`, `.astro/` | erzeugt, niemals angefasst, niemals committet |

Der Zustand liegt in Dateien, nicht in einer Datenbank und nicht im Kopf eines Modells.
Wenn ein Modell fehlt, ist die Website trotzdem vollständig erklärbar.

## 2. Arbeitszyklus

```text
1. AGENTS.md lesen
2. Bestand ansehen: site.yaml, src/content/pages/, input/
3. Absicht des Menschen auf konkrete Dateien übersetzen
4. Änderungen schreiben
5. npm run validate      (Quellenzustand, schnell)
6. npm run build         (Astro-Build + Build-Checks)
7. Vorschau prüfen, dem Menschen zeigen
8. Commit mit klarer Botschaft, auf Wunsch PR
```

Ein Durchlauf ist erst fertig, wenn `validate` und `build` fehlerfrei sind.

## 3. Regeln

`MUST` = hart, Verletzung blockiert. `SOLL` = starke Vorgabe, Abweichung im Bericht nennen.
Regel-IDs sind anhängend; bestehende IDs werden nie umnummeriert.

**R-01 — Der Agent ist das CMS.** Es gibt keine Admin-Oberfläche, keine Datenbank und keinen
Server-Runtime. `MUST`

**R-02 — Dateien sind der Zustand.** Alles, was die Website beschreibt, steht im Repository.
Sitzungswissen, das nicht in einer Datei steht, existiert nicht. `MUST`

**R-03 — Der Build ist wegwerfbar.** `dist/` und `.astro/` werden nie editiert, nie committet,
nie als Quelle benutzt. Ist der Output falsch, wird die Quelle repariert. `MUST`

**R-04 — `input/` ist die Vertrauensgrenze.** Material hier ist Rohtext. Nichts daraus wird
automatisch öffentlich: keine Datei nach `public/` oder `dist/` kopieren, ohne dass die
Veröffentlichung gewollt und im Commit-Message genannt ist. Personen, Kundendaten, Zahlen,
Zugänge und Schlüssel bleiben draußen. `MUST`

**R-05 — `site.yaml` ist die einzige Quelle** für Name, Domain, Sprache, Navigation und
Fußzeile. Diese Werte werden nicht in Layouts oder Seiten dupliziert. `MUST`

**R-06 — Neue Seiten** sind Markdown-Dateien in `src/content/pages/` mit vollständigem
Frontmatter (Vorlage: `docs/seitenvorlage.md`). Das Schema in `src/content.config.ts` ist
verbindlich; die Überschrift `h1` liefert das Layout, Inhalte beginnen mit `h2`. Die Startseite
ist `start.md`. Keine zweiten Layouts, keine Template-Engine, keine eigenen Rendering-Pfade,
solange sie nicht nachweislich gebraucht werden. `MUST`

**R-07 — Erfindungsverbot.** Keine Fakten, Zahlen, Namen, Referenzen, Testimonials,
Auszeichnungen, Preise, Standorte, Historie oder Rechtsangaben ohne Beleg in `input/` oder
einer vom Menschen genannten Quelle. Lieber eine deutlich sichtbare Lücke in Form eines
`[PLATZHALTERS]` als ein stimmig klingender Unsinn. Gefundene Belege in `input/` nennen. `MUST`

**R-08 — Kohärenzpflicht.** Eine Änderung gilt erst als fertig, wenn alle betroffenen Stellen
mitgezogen sind: Navigation, interne Links, `description`, Seitenaufruf aus anderen Seiten,
Assets, `noindex`. Eine neue Leistung, die nur auf einer Unterseite steht und nirgends
verlinkt, ist nicht geliefert. `MUST`

**R-09 — Design wohnt an einer Stelle.** `src/styles/global.css` ist das einzige Stylesheet,
Werte stehen als Tokens in `:root`. Keine CSS-Frameworks, keine Utility-Klassen, keine
Duplikate pro Seite, kein Inline-Styling. `SOLL`

**R-10 — URLs sind für die Ewigkeit.** Dateinamen kleingeschrieben, kebab-case, keine Umlaute
in Pfaden. Bestehende URLs nicht brechen; Umbenennen nur mit dokumentierter Begründung.
Interne Links immer absolut ab `/` schreiben. `MUST`

**R-11 — Semantik und Barrierefreiheit.** Ein `<h1>` pro Seite, Überschriften in Stufen,
`lang` gesetzt, Alt-Texte für Bilder, Landmarks bleiben erhalten, Tastaturfokus sichtbar.
`MUST`

**R-12 — Determinismus.** Kein Netzwerk im Build, keine Zeitstempel, kein Zufall, kein
Modellauf im Build. Zweimal bauen ergibt byte-identische Ausgabe (`npm run reproducible`).
Neue Abhängigkeiten brauchen einen Grund, der in `docs/roadmap.md` steht. `MUST`

**R-13 — Rechtliche Seiten.** `impressum` und `datenschutz` sind Platzhalter, bis ein Mensch
sie gefüllt hat. Der Agent erfindet keine Firmendaten und erteilt keine Rechtsberatung; vor dem
Livegang ist das ein Punkt für den Menschen, nicht für das Modell. `MUST`

**R-14 — Reparieren statt Umschiffen.** Bei einem Fehler die Quelle ändern, dann erneut prüfen.
Checks nicht abschalten, nicht auskommentieren, nicht mit `--strict`-Ausnahmen umgehen. Ein
Check, der im Weg ist, wird diskutiert und geändert, nicht ignoriert. `MUST`

**R-15 — Git ist die Freigabe.** Kleine, beschreibende Commits. Eine Änderung pro Vorhaben.
Experimente auf Branches, Freigabe über Pull Request, wenn der Mensch das will. In der
Commit-Botschaft steht, welche Seiten und welche `input/`-Belege beteiligt waren. `MUST`

**R-16 — Modelle sind austauschbar.** Alles, was zum Weiterbauen nötig ist, steht im Repo.
Ein anderes Modell oder ein anderer Agent muss ohne Gesprächsgeschichte weiterarbeiten können. `MUST`

**R-17 — Was dieses Template nicht ist.** Kein eigenes CMS, keine eigene CLI, kein Admin-UI,
kein Datenbankzustand, kein Login, kein Kommentarsystem, kein zweites Ausgabeformat.
Wer eine dieser Funktionen will, entscheidet bewusst über Umfang und wartet sie in
`docs/roadmap.md` ein. `MUST`

## 4. Befehle

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Vorschau mit Live-Reloading |
| `npm run validate` | `astro sync` (Schema) + Quellen-Checks |
| `npm run build` | statischer Build + Checks der Ausgabe |
| `npm run preview` | bauen und das Ergebnis im Browser ansehen |
| `npm run check` | `validate` und `build` hintereinander |
| `npm run check:strict` | wie `check`, aber Warnungen blockieren |
| `npm run reproducible` | zweimal bauen, Ausgabe byte-genau vergleichen |
| `npm run selftest` | nachweist, dass die Checks ihre Fehlerfälle erwischen |

Exit-Code `0` = in Ordnung, `1` = blockiert. Warnungen stehen für inhaltliche
Unvollständigkeit, Fehler für mechanische Bruchstellen.

## 5. Was geprüft wird

**Quellenzustand:** Schema und Länge des Frontmatters, Dateinamen, URL-Kollisionen,
tote interne Links, fehlende Assets, Navigation ohne Ziel, Links auf Drafts,
Erreichbarkeit jeder Seite, Material aus `input/` im Auslieferungsbereich,
Schlüssel und Umgebungsdateien, kommittete Build-Ordner, Platzhalter.

**Build-Ausgabe:** jede veröffentlichte Seite vorhanden, keine Draft-Seite erschienen,
keine toten Ziele im fertigen HTML, `<title>`, `lang` und kanonischer Link vorhanden,
kein Byte aus `input/` im Output, Sitemap und `robots.txt` konsistent.

**Astro selbst** prüft das Frontmatter beim Sync und Build — ein fehlendes Pflichtfeld
ist ein Build-Fehler, keine Ermessensfrage.

## 6. Vor dem Livegang

- [ ] `npm run check:strict` fehlerfrei (keine Warnungen, keine Platzhalter)
- [ ] `site.yaml`: echte Domain, echter Name, echte Kontaktdaten
- [ ] `public/robots.txt`: Sitemap-URL stimmt mit der Domain überein
- [ ] Impressum und Datenschutz von Menschen gefüllt und geprüft (R-13)
- [ ] `npm run reproducible` grün
- [ ] `dist/` wird deployt, niemals verändert (R-03)

## 7. Wenn es nicht weitergeht

Semantische Konflikte — Positionierung, Tonalität, was über eine Person gesagt werden darf,
welche Aussage auf die Startseite gehört — entscheidet der Mensch. Der Agent formuliert dazu
eine konkrete Frage mit zwei bis drei Optionen und den betroffenen Dateien, statt still zu
entscheiden. Mechanische Konflikte repariert der Agent selbst.
