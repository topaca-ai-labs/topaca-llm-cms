/**
 * URL- und Pfad-Eigenschaften (AGENTS.md R-10).
 *
 * Diese Fälle sind genau die Stelle, an der v0.1 False Positives und
 * stillschweigende Divergenzen erzeugt hat: `/foo` gegen `/foo/`, Query und
 * Fragment als toter Link, Großbuchstaben in Verzeichnissen, `slug: /custom`
 * ohne abschließenden Slash. Die Tabelle ist bewusst die aus dem Audit.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { canonical, invalidSegments, isHomeId, isPagePath, outputFileFor, routeForPage, splitTarget } from '../src/lib/route.mjs';

describe('Zerlegung von Linkzielen', () => {
  const cases = [
    ['/leistungen/', '/leistungen/', '', ''],
    ['/leistungen/?x=1', '/leistungen/', 'x=1', ''],
    ['/leistungen/#details', '/leistungen/', '', 'details'],
    ['/a?x=1#y', '/a', 'x=1', 'y'],
    ['/a?q=1+2&z=3', '/a', 'q=1+2&z=3', ''],
    ['#oben', '', '', 'oben'],
    ['mailto:hi@acme.example', 'mailto:hi@acme.example', '', ''],
  ];
  for (const [input, path, query, fragment] of cases) {
    it(`${input} → Pfad ${path}`, () => {
      assert.deepEqual(splitTarget(input), { path, query, fragment });
    });
  }
});

describe('Kanonische Route', () => {
  const valid = [
    ['/', '/'],
    ['//', '/'],
    ['/leistungen/', '/leistungen/'],
    ['/leistungen', '/leistungen/'],
    ['/leistungen//', '/leistungen/'],
    ['/team/anna/', '/team/anna/'],
    ['/a/b/c', '/a/b/c/'],
  ];
  for (const [input, want] of valid) {
    it(`${JSON.stringify(input)} → ${want}`, () => assert.equal(canonical(input), want));
  }

  const rejected = ['/FOO/', '/über-uns/', '/a b/', '/a%20b/', '/../foo/', 'leistungen/', '', 'mailto:x@y.de'];
  for (const input of rejected) {
    it(`${JSON.stringify(input)} ist keine kanonische Route`, () => assert.equal(canonical(input), null));
  }

  it('Query und Fragment beeinflussen die Route nicht', () => {
    assert.equal(canonical('/leistungen/?x=1'), '/leistungen/');
    assert.equal(canonical('/leistungen/#details'), '/leistungen/');
    assert.equal(canonical('/leistungen/?x=1#details'), '/leistungen/');
  });

  it('Normalisierung ist idempotent', () => {
    for (const input of ['/', '/a', '/a/', '/a//b', '/a/b/', '//a//b//']) {
      const once = canonical(input);
      assert.equal(canonical(once), once, `zweite Normalisierung ändert ${input}`);
    }
  });
});

describe('Segmentprüfung (R-10)', () => {
  const cases = [
    ['/', []],
    ['/leistungen/', []],
    ['/a-b-2/', []],
    ['/UP PER/test/', ['UP PER']],
    ['/Team/', ['Team']],
    ['/über-uns/', ['über-uns']],
    ['/../foo/', ['..']],
    ['/foo%20bar/', ['foo%20bar']],
    ['/a/b C/D/', ['b C', 'D']],
  ];
  for (const [input, want] of cases) {
    it(`${input} → ${want.length ? want.join(', ') : 'ok'}`, () => assert.deepEqual(invalidSegments(input), want));
  }
});

describe('Route einer Seite', () => {
  it('start.md ist die Startseite', () => {
    assert.equal(routeForPage('start.md'), '/');
    assert.equal(routeForPage('start'), '/');
    assert.equal(isHomeId('start.md'), true);
    assert.equal(isHomeId('index.md'), false);
  });

  it('Dateipfad wird zu /pfad/', () => {
    assert.equal(routeForPage('leistungen.md'), '/leistungen/');
    assert.equal(routeForPage('team/anna.md'), '/team/anna/');
  });

  it('expliziter slug wird auf eine Auslieferungsroute gebracht', () => {
    // Der Renderer normalisiert, damit `/custom` nie als `customindex.html`
    // landet. Autorisiert ist nur die kanonische Form — die prüft der Validator
    // als SLUG_INVALID (siehe tests/validator.test.mjs).
    assert.equal(routeForPage('x.md', '/custom/'), '/custom/');
    assert.equal(routeForPage('x.md', '/custom'), '/custom/');
    assert.equal(routeForPage('x.md', '/a//b/'), '/a/b/');
    assert.equal(routeForPage('x.md', '/Custom/'), null); // daraus wird keine Route
  });

  it('Datei im Build', () => {
    assert.equal(outputFileFor('/'), 'index.html');
    assert.equal(outputFileFor('/leistungen/'), 'leistungen/index.html');
    assert.equal(outputFileFor('/team/anna/'), 'team/anna/index.html');
  });
});

describe('Seite oder Asset', () => {
  const pages = ['/leistungen/', '/a/', '/kontakt', '/a.b/index'];
  const assets = ['/bild.png', '/a/b.pdf', '/styles.css', '/x.min.js'];
  for (const p of pages) it(`${p} ist eine Seite`, () => assert.equal(isPagePath(p), true));
  for (const a of assets) it(`${a} ist ein Asset`, () => assert.equal(isPagePath(a), false));
});
