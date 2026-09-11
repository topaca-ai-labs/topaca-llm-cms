/**
 * Integration: echter Build, echte Ausgabe.
 *
 *   npm test
 *
 * Der Quell-Check und der Astro-Renderer dürfen nicht dieselbe Lüge teilen.
 * v0.1 hatte einen Validator, der `start.md` als Startseite akzeptierte, während
 * der Renderer eine Datei namens `index.md` brauchte — sichtbar erst im gebauten
 * Ergebnis. Dieser Test baut das Projekt und prüft die Ausgabe mit demselben
 * Validator, den CI benutzt.
 *
 * Er ist der langsamste Test im Lauf (ein Astro-Build) und deshalb als einziger
 * übersprungen, wenn die Abhängigkeiten fehlen — dann sagt er deutlich, warum.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { after, before, describe, it } from 'node:test';
import { load } from 'js-yaml';
import { CHECK, REPO } from './helpers.mjs';

const ASTRO = path.join(REPO, 'node_modules', '.bin', process.platform === 'win32' ? 'astro.cmd' : 'astro');
const haveAstro = existsSync(ASTRO);

const run = (cmd, args) => spawnSync(cmd, args, { cwd: REPO, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const checkDist = (args = []) => {
  const res = run(process.execPath, [CHECK, 'dist', '--json', ...args]);
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch {}
  return { code: res.status, json, stdout: res.stdout, stderr: res.stderr };
};
const distFile = (rel) => readFileSync(path.join(REPO, 'dist', rel), 'utf8');

describe('Build des Referenzprojekts', { skip: haveAstro ? false : 'astro nicht installiert — npm ci' }, () => {
  let site;
  before(() => {
    site = load(readFileSync(path.join(REPO, 'site.yaml'), 'utf8'));
    const build = run(ASTRO, ['build']);
    assert.equal(build.status, 0, `astro build fehlgeschlagen:\n${build.stdout}\n${build.stderr}`);
  });

  after(() => {
    // Der Build ist Wegwerfprodukt (R-03). Ein Test hinterlässt ihn nicht.
    spawnSync('rm', ['-rf', path.join(REPO, 'dist')], { stdio: 'ignore' });
  });

  it('der dist-Check akzeptiert das Ergebnis', () => {
    const res = checkDist();
    const errors = (res.json?.diagnostics ?? []).filter((d) => d.severity === 'error').map((d) => `${d.code} ${d.file} — ${d.message}`);
    assert.equal(res.code, 0, `dist-Check blockiert:\n${errors.join('\n')}`);
  });

  it('baut genau die Seiten, die der Quell-Check zählt', () => {
    for (const route of ['/', '/leistungen/', '/ueber-uns/', '/kontakt/', '/impressum/', '/datenschutz/']) {
      const file = route === '/' ? 'index.html' : `${route.slice(1)}index.html`;
      assert.ok(existsSync(path.join(REPO, 'dist', file)), `fehlt: dist/${file}`);
    }
  });

  it('das Template ist im development-Zustand nicht indexierbar (Audit §27)', () => {
    assert.match(distFile('index.html'), /name="robots" content="noindex/);
    assert.match(distFile('robots.txt'), /^Disallow: \//m);
    assert.doesNotMatch(distFile('robots.txt'), /^Allow: \//m);
  });

  it('liefert keine Projektdateien aus (Audit §26)', () => {
    const res = run('find', ['dist', '-name', 'README.md', '-o', '-name', '*.map', '-o', '-name', '.DS_Store']);
    assert.equal(res.stdout.trim(), '', `unerwartete Dateien im Build:\n${res.stdout}`);
    assert.equal(existsSync(path.join(REPO, 'dist', 'AGENTS.md')), false);
    assert.equal(existsSync(path.join(REPO, 'dist', 'site.yaml')), false);
  });

  it('rendert Kontaktwerte aus site.yaml, nicht aus der Seite (R-05)', () => {
    const kontakt = distFile('kontakt/index.html');
    assert.match(kontakt, new RegExp(site.contact.email.replace(/[[\]\\]/g, '\\$&')));
    assert.match(kontakt, new RegExp(site.contact.phone.replace(/[[\]\\]/g, '\\$&')));
  });

  it('eine einzige h1 pro Seite, aus dem Layout (R-11)', () => {
    const start = distFile('index.html');
    assert.equal((start.match(/<h1[\s>]/g) ?? []).length, 1);
    assert.match(start, /<h1>[^<]+<\/h1>/);
  });

  it('canonical und lang kommen aus der Konfiguration (R-05, R-10)', () => {
    assert.match(distFile('index.html'), new RegExp(`rel="canonical" href="${site.url}/"`));
    assert.match(distFile('index.html'), new RegExp(`<html lang="${site.language}"`));
  });

  it('die Sitemap deckt sich mit den gebauten Seiten', () => {
    const xml = distFile('sitemap.xml');
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    assert.equal(locs.length, 6, `6 veröffentlichte Seiten erwartet: ${locs.join(', ')}`);
    for (const loc of locs) assert.ok(loc.startsWith(site.url), `${loc} außerhalb von ${site.url}`);
    assert.ok(locs.includes(`${site.url}/leistungen/`));
    assert.equal(locs.some((l) => l.endsWith('//')), false);
  });

  it('der Release-Check scheitert am Platzhalter-Template, nicht am Aufbau', () => {
    const res = checkDist(['--release']);
    assert.equal(res.code, 1);
    const codes = new Set((res.json?.diagnostics ?? []).map((d) => d.code));
    assert.ok(codes.has('PLACEHOLDER'), `erwartet PLACEHOLDER, gefunden: ${[...codes].join(', ')}`);
  });
});
