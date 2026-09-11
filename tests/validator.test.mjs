/**
 * Contract-Tests für den Validator (scripts/check.mjs).
 *
 *   npm test
 *
 * Jeder Fall verlangt eine benannte Diagnose an der richtigen Stelle. Ein Test,
 * der nur "Exit ungleich 0" prüft, beweist nichts: ein fehlendes Verzeichnis
 * sieht genauso aus wie ein erkannte Regelverletzung. Deshalb:
 *
 *   erwartet wird  exit 1  +  { code, file, line, severity }
 *
 * Die Fälle folgen den Befunden des Audits (v0.1): Fail-open-Modus, Query und
 * Fragment als toter Link, kanonische Navigationsduplikate, ungültige
 * Verzeichnisse, Startseite-Vertrag, site.yaml-Crash, MUST als Warnung,
 * indexierbares Template, Veröffentlichung interner Dateien, Umfang des
 * Hash-Vergleichs.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, it } from 'node:test';
import { append, assertBlocked, assertClean, assertWarns, diagnostics, fixture, git, MATERIAL, pageHtml, patch, remove, REPO, run, write, writeDist } from './helpers.mjs';

/* ------------------------------ Grundzustand ------------------------------ */

describe('Basis-Fixture', () => {
  it('ist im Quellenzustand frei — ohne Fehler und ohne Warnungen', (t) => {
    assertClean(run(fixture(t)), {}, 'Basis');
  });

  it('liefert eine vollständige JSON-Diagnose', (t) => {
    const res = run(fixture(t));
    assert.equal(res.json.mode, 'source');
    assert.equal(res.json.lifecycle, 'development');
    assert.equal(typeof res.json.summary.errors, 'number');
    assert.ok(Array.isArray(res.json.diagnostics));
  });

  it('akzeptiert einen Build, der zu den Quellen passt', (t) => {
    const dir = fixture(t, (d) => writeDist(d));
    assertClean(run(dir, 'dist'), {}, 'Build');
  });
});

/* ------------------------------ Aufruf (P0) ------------------------------- */

describe('Aufruf', () => {
  it('unbekannter Modus schlägt fail-closed fehl (Audit §11)', (t) => {
    const res = run(fixture(t), 'typo-mode');
    assert.equal(res.code, 2, 'Exit 2: nichts wurde geprüft');
    assert.equal(res.json.diagnostics[0].code, 'UNKNOWN_MODE');
    assert.match(res.json.diagnostics[0].message, /unbekannter Modus/);
  });

  it('fehlt der Build, ist das ein Fehler und kein leerer Erfolg', (t) => {
    assertBlocked(run(fixture(t), 'dist'), [{ code: 'DIST_MISSING', severity: 'error' }]);
  });
});

/* --------------------------- Links und Assets ----------------------------- */

describe('Interne Links', () => {
  it('toter interner Link wird mit Datei und Zeile gemeldet', (t) => {
    const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', '\nSiehe [ fehlt ](/gibt-es-nicht/).\n'));
    assertBlocked(run(dir), [{ code: 'DEAD_INTERNAL_LINK', file: 'src/content/pages/start.md', line: 9 }]);
  });

  it('Fragment ändert die Route nicht (Audit §12)', (t) => {
    const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', '\nSiehe [Details](/leistungen/#details).\n'));
    assertClean(run(dir), { absent: ['DEAD_INTERNAL_LINK'] }, 'Fragment');
  });

  it('Query ändert die Route nicht (Audit §12)', (t) => {
    const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', '\nSiehe [Liste](/leistungen/?seite=2).\n'));
    assertClean(run(dir), { absent: ['DEAD_INTERNAL_LINK'] }, 'Query');
  });

  it('Query und Fragment zusammen', (t) => {
    const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', '\nSiehe [Kombi](/leistungen/?seite=2#oben).\n'));
    assertClean(run(dir), { absent: ['DEAD_INTERNAL_LINK'] }, 'Query und Fragment');
  });

  it('fehlendes Asset wird gemeldet', (t) => {
    const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', '\n![Bild](/assets/fehlt.png)\n'));
    assertBlocked(run(dir), [{ code: 'ASSET_MISSING', file: 'src/content/pages/start.md', line: 9 }]);
  });

  it('leerer Alt-Text ist ein Fehler, keine Warnung (MUST, Audit §18)', (t) => {
    const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', '\n![](/assets/bild.svg)\n'));
    assertBlocked(run(dir), [{ code: 'EMPTY_ALT', severity: 'error' }]);
  });

  it('externes Bild wird als Freigabefrage gemeldet', (t) => {
    const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', '\n![Team](https://cdn.example/team.png)\n'));
    const res = run(dir);
    assert.equal(res.code, 0);
    assert.equal(diagnostics(res, 'IMAGE_REMOTE')[0].severity, 'warning');
  });

  it('lokale Adresse darf nicht veröffentlicht werden', (t) => {
    const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', '\n[Dev](http://localhost:4321/)\n'));
    assertBlocked(run(dir), [{ code: 'LINK_LOCALHOST' }]);
  });

  it('unsichere http-Adresse blockiert im production-Zustand', (t) => {
    const dir = fixture(t, (d) => {
      append(d, 'src/content/pages/start.md', '\n[Alt](http://acme.example/alt/)\n');
      patch(d, 'site.yaml', 'lifecycle: development', 'lifecycle: production');
    });
    assertBlocked(run(dir), [{ code: 'LINK_INSECURE', severity: 'error' }]);
  });

  it('relativer Link ist eine Warnung mit Hinweis', (t) => {
    const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', '\n[relativ](leistungen/)\n'));
    const res = run(dir);
    assert.equal(diagnostics(res, 'LINK_RELATIVE')[0].severity, 'warning');
    assert.ok(diagnostics(res, 'LINK_RELATIVE')[0].hint);
  });

  it('Link auf eine Draft-Seite ist ein Fehler', (t) => {
    const dir = fixture(t, (d) => {
      write(d, 'src/content/pages/entwurf.md', '---\ntitle: Entwurf\ndraft: true\ndescription: Ein hinreichend langer Beschreibungstext für den Entwurf.\n---\n\nText\n');
      append(d, 'src/content/pages/start.md', '\nSiehe [Entwurf](/entwurf/).\n');
    });
    assertBlocked(run(dir), [{ code: 'LINK_DRAFT_TARGET', file: 'src/content/pages/start.md' }]);
  });

  it('unverlinkte Seite wird als Erreichbarkeitsproblem gemeldet', (t) => {
    const dir = fixture(t, (d) => write(d, 'src/content/pages/nobody.md', '---\ntitle: Nobody\ndescription: Eine Seite ohne Zugang, mit einem langen Beschreibungstext.\n---\n\nNiemand verlinkt sie.\n'));
    assertWarns(run(dir), [{ code: 'UNREACHABLE', file: 'src/content/pages/nobody.md', severity: 'warning' }], 'Erreichbarkeit');
    assert.equal(run(dir, 'source', ['--strict']).code, 1, '--strict blockiert auch bei Warnungen');
  });
});

/* --------------------- Seiten, Dateien, Routenverträge -------------------- */

describe('Seiten und Routen', () => {
  it('Startseite ist ausschließlich start.md (Audit §15)', (t) => {
    const dir = fixture(t, (d) => {
      remove(d, 'src/content/pages/start.md');
      write(d, 'src/content/pages/home.md', '---\ntitle: Home\ndescription: Eine andere Startseite mit slug /. Der Build kennt nur start.md.\nslug: /\n---\n\nText\n');
    });
    assertBlocked(run(dir), [{ code: 'NO_START_PAGE' }, { code: 'SLUG_RESERVED' }]);
  });

  it('index.md ist reserviert', (t) => {
    const dir = fixture(t, (d) => write(d, 'src/content/pages/index.md', '---\ntitle: Index\ndescription: Eine Seite mit dem reservierten Dateinamen index.md.\n---\n\nText\n'));
    assertBlocked(run(dir), [{ code: 'RESERVED_FILENAME' }]);
  });

  it('alle Pfadsegmente folgen R-10 (Audit §14)', (t) => {
    const dir = fixture(t, (d) => write(d, 'src/content/pages/UP PER/test.md', '---\ntitle: Test\ndescription: Seite in einem ungültigen Verzeichnis mit langem Text.\n---\n\nText\n'));
    const res = run(dir);
    assertBlocked(res, [{ code: 'PATH_SEGMENT', file: 'src/content/pages/UP PER/test.md' }]);
    assert.match(diagnostics(res, 'PATH_SEGMENT')[0].message, /UP PER/);
  });

  it('nicht kanonischer slug wird abgelehnt (Audit §16)', (t) => {
    const dir = fixture(t, (d) => write(d, 'src/content/pages/custom.md', '---\ntitle: Custom\ndescription: Seite mit einem slug ohne abschließenden Slash. Text.\nslug: /custom\n---\n\nText\n'));
    const res = run(dir);
    assertBlocked(res, [{ code: 'SLUG_INVALID' }, { code: 'UNREACHABLE' }]);
  });

  it('URL-Kollision zweier Seiten', (t) => {
    const dir = fixture(t, (d) => {
      write(d, 'src/content/pages/erste.md', '---\ntitle: Erste\ndescription: Erste Seite mit demselben Ziel wie die zweite Seite hier.\nslug: /dopplung/\n---\n\nText\n');
      write(d, 'src/content/pages/zweite.md', '---\ntitle: Zweite\ndescription: Zweite Seite mit demselben Ziel wie die erste Seite hier.\nslug: /dopplung/\n---\n\nText\n');
    });
    assertBlocked(run(dir), [{ code: 'URL_COLLISION' }]);
  });

  it('fehlendes Frontmatter', (t) => {
    const dir = fixture(t, (d) => write(d, 'src/content/pages/ohne.md', '# Nur Überschrift\n\nText ohne Frontmatter.\n'));
    assertBlocked(run(dir), [{ code: 'FRONTMATTER_MISSING' }]);
  });

  it('fehlerhaftes YAML im Frontmatter wird benannt', (t) => {
    const dir = fixture(t, (d) => write(d, 'src/content/pages/kaputt.md', '---\ntitle: "ohne Ende\ndescription: zu kurz\n---\n\nText\n'));
    assertBlocked(run(dir), [{ code: 'FRONTMATTER_YAML' }]);
  });

  it('title und description sind Pflicht', (t) => {
    const dir = fixture(t, (d) => write(d, 'src/content/pages/duenn.md', '---\ndescription: zu kurz\n---\n\nText\n'));
    assertBlocked(run(dir), [{ code: 'TITLE_MISSING' }, { code: 'DESCRIPTION_MISSING' }]);
  });

  it('Draft der Startseite ist unmöglich', (t) => {
    const dir = fixture(t, (d) => patch(d, 'src/content/pages/start.md', 'title: Start', 'title: Start\ndraft: true'));
    assertBlocked(run(dir), [{ code: 'START_DRAFT' }]);
  });
});

/* ----------------------------- site.yaml (P1) ----------------------------- */

describe('Konfiguration site.yaml', () => {
  it('strukturell ungültige Werte ergeben eine Diagnose, keinen Crash (Audit §17)', (t) => {
    const dir = fixture(t, (d) => patch(d, 'site.yaml', 'nav:\n  - label: Leistungen\n    href: /leistungen/', 'nav: falsch'));
    const res = run(dir);
    assertBlocked(res, [{ code: 'SITE_YAML_INVALID' }]);
    assert.doesNotMatch(res.stderr, /TypeError/);
  });

  it('unbekanntes Feld ist ein Fehler, keine stillgelegte Konfiguration', (t) => {
    const dir = fixture(t, (d) => patch(d, 'site.yaml', 'language: "de"', 'language: "de"\nnavi:\n  - label: Tippfehler\n    href: /x/'));
    const res = run(dir);
    assertBlocked(res, [{ code: 'SITE_YAML_INVALID' }]);
    assert.match(JSON.stringify(res.json), /navi/);
  });

  it('unbekannter Lebenszyklus wird abgelehnt', (t) => {
    const dir = fixture(t, (d) => patch(d, 'site.yaml', 'lifecycle: development', 'lifecycle: live'));
    assertBlocked(run(dir), [{ code: 'SITE_YAML_INVALID' }]);
  });

  it('Domain in http oder mit Slash', (t) => {
    const dir = fixture(t, (d) => patch(d, 'site.yaml', 'url: "https://acme.example"', 'url: "http://acme.example/"'));
    assertBlocked(run(dir), [{ code: 'SITE_YAML_INVALID' }]);
  });

  it('Platzhalter-Domain wird gemeldet', (t) => {
    const dir = fixture(t, (d) => patch(d, 'site.yaml', 'https://acme.example', 'https://example.com'));
    const res = run(dir);
    assert.equal(diagnostics(res, 'SITE_URL_PLACEHOLDER')[0].severity, 'warning');
  });

  it('Navigationsziel fehlt', (t) => {
    const dir = fixture(t, (d) => patch(d, 'site.yaml', '/kontakt/', '/unbekannt/'));
    assertBlocked(run(dir), [{ code: 'NAV_TARGET_MISSING' }]);
  });

  it('Navigationsziel ist ein Draft', (t) => {
    const dir = fixture(t, (d) => {
      write(d, 'src/content/pages/entwurf.md', '---\ntitle: Entwurf\ndraft: true\ndescription: Ein hinreichend langer Beschreibungstext für den Entwurf.\n---\n\nText\n');
      patch(d, 'site.yaml', '/kontakt/', '/entwurf/');
    });
    assertBlocked(run(dir), [{ code: 'NAV_TARGET_DRAFT' }]);
  });

  it('dasselbe Ziel zweimal in der Navigation', (t) => {
    const dir = fixture(t, (d) => patch(d, 'site.yaml', '  - label: Kontakt\n    href: /kontakt/', '  - label: Kontakt\n    href: /kontakt/\n  - label: Kontakt zweimal\n    href: /kontakt/'));
    assertBlocked(run(dir), [{ code: 'NAV_DUPLICATE', target: '/kontakt/' }]);
  });

  it('Duplikat, das nur durch den fehlenden Slash unterscheidbar ist (Audit §13)', (t) => {
    // v0.1 verglich die rohen Zeichenketten: /kontakt und /kontakt/ galten als
    // verschiedene Ziele. Verglichen wird die kanonische Route.
    const dir = fixture(t, (d) => patch(d, 'site.yaml', '  - label: Kontakt\n    href: /kontakt/', '  - label: Kontakt\n    href: /kontakt\n  - label: Kontakt zweimal\n    href: /kontakt/'));
    const res = run(dir);
    assertBlocked(res, [{ code: 'SITE_YAML_INVALID' }, { code: 'NAV_DUPLICATE' }]);
  });

  it('Navigation und Footer dürfen auf dieselbe Seite zeigen', (t) => {
    // Absicht: footer ist ein eigener Bereich, die Duplikatprüfung gilt je Liste.
    const dir = fixture(t, (d) => patch(d, 'site.yaml', '  - label: Impressum\n    href: /impressum/', '  - label: Impressum\n    href: /impressum/\n  - label: Kontakt\n    href: /kontakt/'));
    assertClean(run(dir), { absent: ['NAV_DUPLICATE'] }, 'Footer');
  });

  it('nicht kanonischer href in der Navigation', (t) => {
    const dir = fixture(t, (d) => patch(d, 'site.yaml', 'href: /leistungen/', 'href: /leistungen'));
    assertBlocked(run(dir), [{ code: 'SITE_YAML_INVALID' }]);
  });

  it('fehlt die Datei ganz', (t) => {
    const dir = fixture(t, (d) => remove(d, 'site.yaml'));
    assertBlocked(run(dir), [{ code: 'SITE_YAML_MISSING' }]);
  });
});

/* ------------------------- Vertrauensgrenze input/ ------------------------ */

describe('Vertrauensgrenze', () => {
  it('input/-Ordner im Auslieferungsbereich', (t) => {
    const dir = fixture(t, (d) => write(d, 'public/input/lohnlisten.txt', 'Löhne\n'));
    assertBlocked(run(dir), [{ code: 'INPUT_IN_PUBLIC' }]);
  });

  it('byte-identische Übernahme wird gemeldet', (t) => {
    const dir = fixture(t, (d) => write(d, 'public/assets/profil.pdf', MATERIAL));
    const res = run(dir);
    assert.equal(diagnostics(res, 'INPUT_IDENTICAL_FILE')[0].severity, 'warning');
  });

  it('eine geänderte Zeile entgeht dem Hash-Vergleich — dokumentierte Grenze (Audit §10)', (t) => {
    const original = MATERIAL;
    const dir = fixture(t, (d) => write(d, 'public/assets/profil.pdf', `${original} \n`));
    const res = run(dir);
    assert.equal(diagnostics(res, 'INPUT_IDENTICAL_FILE').length, 0, 'erkannt werden nur vollständig identische Dateien');
  });

  it('getracktes Material in input/ blockiert das Release (P1-05)', (t) => {
    const dir = fixture(t, (d) => {
      patch(d, 'site.yaml', 'lifecycle: development', 'lifecycle: production');
      git(d, ['init', '-q']);
      git(d, ['config', 'user.email', 'test@example.invalid']);
      git(d, ['config', 'user.name', 'Test']);
      git(d, ['add', '-A']);
      git(d, ['add', '-f', 'input/documents/profil.pdf']); // bewusst gegen .gitignore
      git(d, ['commit', '-qm', 'material']);
    });
    const res = run(dir);
    assertBlocked(res, [{ code: 'INPUT_TRACKED', file: 'input/documents/profil.pdf' }]);
  });

  it('privates Material bleibt ohne git-Add unverfolgt und stört nicht', (t) => {
    const dir = fixture(t, (d) => {
      patch(d, 'site.yaml', 'lifecycle: development', 'lifecycle: production');
      git(d, ['init', '-q']);
      git(d, ['config', 'user.email', 'test@example.invalid']);
      git(d, ['config', 'user.name', 'Test']);
      git(d, ['add', '-A']);
      git(d, ['commit', '-qm', 'nur vorlage']);
    });
    assertClean(run(dir), {}, 'unverfolgtes Material');
  });

  // Die Geheimnisse in diesen Tests werden zur Laufzeit zusammengesetzt. Ein
  // literaler Text in dieser Datei wäre ein Fund für jeden Scanner — auch für
  // den hier getesteten. v0.1 hat sich selbst gemeldet.
  const TOKEN = ['sk', 'abcdefghijklmnopqrstuvwxyz0123'].join('-');
  const KEY = `${'-'.repeat(5)}BEGIN RSA PRIVATE KEY${'-'.repeat(5)}`;

  it('Zugriffstoken in einer Datei wird gefunden', (t) => {
    const dir = fixture(t, (d) => write(d, 'notizen.txt', `token = "${TOKEN}"\n`));
    assertBlocked(run(dir), [{ code: 'SECRET_CONTENT', file: 'notizen.txt', line: 1 }]);
  });

  it('Privater Schlüssel im Inhalt wird gefunden', (t) => {
    const dir = fixture(t, (d) => write(d, 'src/content/pages/notiz.md', `---\ntitle: Notiz\ndescription: Seite mit einem Schlüssel im Text, lang beschrieben.\n---\n\n${KEY}\n`));
    assertBlocked(run(dir), [{ code: 'SECRET_CONTENT', file: 'src/content/pages/notiz.md' }]);
  });

  it('Basis-Ref aus der CI erkennt Control-Plane-Änderungen (R-19)', (t) => {
    const dir = fixture(t, (d) => {
      git(d, ['init', '-q', '-b', 'main']);
      git(d, ['config', 'user.email', 'test@example.invalid']);
      git(d, ['config', 'user.name', 'Test']);
      git(d, ['add', '-A']);
      git(d, ['commit', '-qm', 'ausgang']);
      git(d, ['checkout', '-q', '-b', 'agent/anderes-design']);
      // Der Agent ändert Inhalt UND den Validator.
      append(d, 'src/content/pages/start.md', 'Ein neuer Absatz.\n');
      append(d, 'scripts/check.mjs', '\n// geänderte Prüfung\n');
      git(d, ['add', '-A']);
      git(d, ['commit', '-qm', 'änderung']);
    });
    // Ohne Basis-Ref ist nichts committet, also nichts zu sehen.
    assertClean(run(dir), { absent: ['CONTROL_PLANE_CHANGED'] }, 'ohne Basis');
    const res = run(dir, 'source', [], { CHECK_BASE_REF: 'main' });
    assertWarns(res, [{ code: 'CONTROL_PLANE_CHANGED', severity: 'warning' }], 'mit Basis');
    assert.equal(run(dir, 'source', ['--strict'], { CHECK_BASE_REF: 'main' }).code, 1, '--strict blockiert');
  });

  it('ein unlesbarer Basis-Ref ist eine Diagnose, kein Abbruch', (t) => {
    const dir = fixture(t);
    const res = run(dir, 'source', [], { CHECK_BASE_REF: 'main; rm -rf /' });
    assertWarns(res, [{ code: 'BASE_REF_INVALID' }], 'Ref-Injection');
    const unknown = run(dir, 'source', [], { CHECK_BASE_REF: 'gibt-es-nicht' });
    assertWarns(unknown, [{ code: 'BASE_REF_UNKNOWN' }], 'unbekannter Ref');
  });

  it('das Template selbst enthält keinen Selbstfund (v0.1-Problem)', () => {
    // Läuft gegen das echte Projekt: ein Scanner, der eigene Testdaten meldet,
    // macht jede Prüfung dauerhaft rot.
    const res = run(REPO);
    assert.equal(diagnostics(res, 'SECRET_CONTENT').length, 0, 'der Scanner darf seine eigenen Testdaten nicht melden');
    assert.equal(diagnostics(res, 'SECRET_FILE').length, 0);
  });

  it('Schlüsseldatei wird gefunden', (t) => {
    const dir = fixture(t, (d) => write(d, 'config.pem', 'privater Schlüssel\n'));
    assertBlocked(run(dir), [{ code: 'SECRET_FILE' }]);
  });

  it('.gitignore ohne dist/ ist ein Fehler', (t) => {
    const dir = fixture(t, (d) => patch(d, '.gitignore', 'dist/\n', ''));
    assertBlocked(run(dir), [{ code: 'GITIGNORE_MISSING' }]);
  });

  it('.gitignore ohne input/** ist ein Fehler', (t) => {
    const dir = fixture(t, (d) => patch(d, '.gitignore', 'input/**\n', ''));
    assertBlocked(run(dir), [{ code: 'GITIGNORE_MISSING' }]);
  });
});

/* --------------------- Markdown ist Inhalt, kein Code --------------------- */

describe('Inhaltssicherheit (R-18)', () => {
  const cases = [
    ['<script>alert(1)</script>', 'script'],
    ['<iframe src="https://evil.example"></iframe>', 'iframe'],
    ['<a href="javascript:alert(1)">klick</a>', 'javascript:'],
    ['<img src="x" onerror="alert(1)">', 'event handler'],
    ['<form action="https://evil.example"><input></form>', 'form'],
  ];
  for (const [line, label] of cases) {
    it(label, (t) => {
      const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', `\n${line}\n`));
      assertBlocked(run(dir), [{ code: 'UNSAFE_MARKDOWN', file: 'src/content/pages/start.md' }], label);
    });
  }
});

/* ------------------------------- Belege (R-07) ---------------------------- */

describe('Provenienz', () => {
  it('fehlende Quelle wird gemeldet', (t) => {
    const dir = fixture(t, (d) => patch(d, 'src/content/pages/leistungen.md', 'input/documents/profil.pdf', 'input/documents/fehlt.pdf'));
    assertBlocked(run(dir), [{ code: 'SOURCE_MISSING' }]);
  });

  it('Quelle außerhalb von input/ wird gemeldet', (t) => {
    const dir = fixture(t, (d) => patch(d, 'src/content/pages/leistungen.md', 'input/documents/profil.pdf', '../Geheimnisse/zahlen.pdf'));
    assertBlocked(run(dir), [{ code: 'SOURCE_PATH' }]);
  });

  it('vorhandene Quelle ist in Ordnung', (t) => {
    assertClean(run(fixture(t)), {}, 'Quelle vorhanden');
  });
});

/* -------------------------- Lebenszyklus und Release ---------------------- */

describe('Lebenszyklus (R-21)', () => {
  it('Platzhalter sind im development eine Warnung', (t) => {
    const dir = fixture(t, (d) => append(d, 'src/content/pages/start.md', '\nHier steht [FIRMENNAME] als Platzhalter.\n'));
    const res = run(dir);
    assert.equal(diagnostics(res, 'PLACEHOLDER')[0].severity, 'warning');
  });

  it('Platzhalter blockieren im production-Zustand', (t) => {
    const dir = fixture(t, (d) => {
      append(d, 'src/content/pages/start.md', '\nHier steht [FIRMENNAME] als Platzhalter.\n');
      patch(d, 'site.yaml', 'lifecycle: development', 'lifecycle: production');
    });
    assertBlocked(run(dir), [{ code: 'PLACEHOLDER', severity: 'error' }]);
  });

  it('Release verlangt lifecycle: production', (t) => {
    const dir = fixture(t, (d) => writeDist(d));
    const res = run(dir, 'dist', ['--release']);
    assertBlocked(res, [{ code: 'LIFECYCLE_NOT_PRODUCTION' }]);
  });

  it('Release im production-Zustand ohne Platzhalter geht durch', (t) => {
    const dir = fixture(t, (d) => {
      patch(d, 'site.yaml', 'lifecycle: development', 'lifecycle: production');
      writeDist(d, {}, { robots: ['User-agent: *', 'Allow: /', '', 'Sitemap: https://acme.example/sitemap.xml'].join('\n') });
    });
    const res = run(dir, 'dist', ['--release']);
    const errors = (res.json?.diagnostics ?? []).filter((x) => x.severity === 'error');
    assert.deepEqual(errors.map((x) => x.code), [], `keine Fehler erwartet: ${JSON.stringify(errors, null, 2)}`);
    assert.equal(res.code, 0);
  });

  it('Kontaktplatzhalter blockieren den production-Zustand', (t) => {
    const dir = fixture(t, (d) => {
      patch(d, 'site.yaml', 'lifecycle: development', 'lifecycle: production');
      patch(d, 'site.yaml', 'email: "kontakt@acme.example"', 'email: "[E-MAIL]"');
    });
    assertBlocked(run(dir), [{ code: 'CONTACT_PLACEHOLDER' }]);
  });
});

/* ------------------------------ Build-Ausgabe ----------------------------- */

describe('Build-Checks', () => {
  it('Seite fehlt im Build', (t) => {
    const dir = fixture(t, (d) => writeDist(d, { '/leistungen/': null }));
    assertBlocked(run(dir, 'dist'), [{ code: 'PAGE_MISSING_IN_BUILD', file: 'src/content/pages/leistungen.md' }]);
  });

  it('Draft-Seite wurde veröffentlicht', (t) => {
    const dir = fixture(t, (d) => {
      write(d, 'src/content/pages/entwurf.md', '---\ntitle: Entwurf\ndraft: true\ndescription: Ein hinreichend langer Beschreibungstext für den Entwurf.\n---\n\nText\n');
      writeDist(d);
      write(d, 'dist/entwurf/index.html', pageHtml({ title: 'Entwurf' }));
    });
    assertBlocked(run(dir, 'dist'), [{ code: 'DRAFT_PUBLISHED' }]);
  });

  it('totes Ziel im fertigen HTML', (t) => {
    const dir = fixture(t, (d) => writeDist(d, { '/': pageHtml({ title: 'Start', body: '<a href="/verlust/">alt</a>' }) }));
    assertBlocked(run(dir, 'dist'), [{ code: 'DEAD_TARGET', file: 'dist/index.html' }]);
  });

  it('Sprungmarke ohne Ziel', (t) => {
    const dir = fixture(t, (d) =>
      writeDist(d, {
        '/': pageHtml({ title: 'Start', body: '<a href="/leistungen/#unten">unten</a>' }),
        '/leistungen/': pageHtml({ title: 'Leistungen', body: '<p>keine id</p>' }),
      }),
    );
    assertBlocked(run(dir, 'dist'), [{ code: 'DEAD_ANCHOR' }]);
  });

  it('Sprungmarke mit Ziel ist in Ordnung', (t) => {
    const dir = fixture(t, (d) =>
      writeDist(d, {
        '/': pageHtml({ title: 'Start', body: '<a href="/leistungen/#unten">unten</a>' }),
        '/leistungen/': pageHtml({ title: 'Leistungen', body: '<h2 id="unten">unten</h2>' }),
      }),
    );
    assertClean(run(dir, 'dist'), {}, 'Sprungmarke');
  });

  it('zwei h1', (t) => {
    const dir = fixture(t, (d) => writeDist(d, { '/': pageHtml({ title: 'Start', h1: 2 }) }));
    assertBlocked(run(dir, 'dist'), [{ code: 'H1_COUNT', file: 'dist/index.html' }]);
  });

  it('ohne lang', (t) => {
    const dir = fixture(t, (d) => writeDist(d, { '/': pageHtml({ title: 'Start', lang: '' }) }));
    assertBlocked(run(dir, 'dist'), [{ code: 'NO_LANG' }]);
  });

  it('Seite ist im development-Zustand indexierbar', (t) => {
    const dir = fixture(t, (d) => writeDist(d, { '/': pageHtml({ title: 'Start', robots: 'index, follow' }) }));
    assertBlocked(run(dir, 'dist'), [{ code: 'INDEXABLE_IN_DEVELOPMENT' }]);
  });

  it('interne Dokumentation im Auslieferungszustand (Audit §26)', (t) => {
    const dir = fixture(t, (d) => {
      writeDist(d);
      write(d, 'dist/assets/README.md', '# interne Hinweise\n');
      write(d, 'dist/.DS_Store', 'xx');
    });
    const res = run(dir, 'dist');
    assertBlocked(res, [{ code: 'FORBIDDEN_DIST_FILE', file: 'dist/assets/README.md' }]);
    assert.equal(diagnostics(res, 'FORBIDDEN_DIST_FILE').some((d) => d.file === 'dist/.DS_Store'), true);
  });

  it('Quellkarten und Schlüssel im dist', (t) => {
    const dir = fixture(t, (d) => {
      writeDist(d);
      write(d, 'dist/app.js.map', '{}');
      write(d, 'dist/server.key', 'geheim');
    });
    assertBlocked(run(dir, 'dist'), [{ code: 'FORBIDDEN_DIST_FILE' }]);
  });

  it('Material aus input/ im dist ist ein Fehler', (t) => {
    const dir = fixture(t, (d) => {
      writeDist(d);
      write(d, 'dist/profil.pdf', MATERIAL);
    });
    assertBlocked(run(dir, 'dist'), [{ code: 'INPUT_IN_DIST', file: 'dist/profil.pdf' }]);
  });

  it('robots.txt passt nicht zum Lebenszyklus', (t) => {
    const dir = fixture(t, (d) => {
      patch(d, 'site.yaml', 'lifecycle: development', 'lifecycle: production');
      writeDist(d, {}, { robots: 'User-agent: *\nDisallow: /\n' });
    });
    assertBlocked(run(dir, 'dist'), [{ code: 'ROBOTS_LIFECYCLE_MISMATCH' }]);
  });

  it('Sitemap verweist auf eine andere Domain', (t) => {
    const dir = fixture(t, (d) =>
      writeDist(d, {}, {
        robots: ['User-agent: *', 'Allow: /', '', 'Sitemap: https://andere.example/sitemap.xml'].join('\n'),
        sitemap: '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://andere.example/</loc></url></urlset>',
      }),
    );
    const res = run(dir, 'dist');
    assertBlocked(res, [{ code: 'ROBOTS_ORIGIN' }]);
    assert.equal(diagnostics(res, 'SITEMAP_ORIGIN').length > 0, true);
  });

  it('leere Datei im Build', (t) => {
    const dir = fixture(t, (d) => {
      writeDist(d);
      write(d, 'dist/leer.txt', '');
    });
    assertBlocked(run(dir, 'dist'), [{ code: 'EMPTY_FILE' }]);
  });
});
