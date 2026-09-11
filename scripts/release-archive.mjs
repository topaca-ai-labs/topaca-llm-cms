#!/usr/bin/env node
/**
 * Release-Archiv (AGENTS.md R-03, R-21).
 *
 *   npm run release:archive
 *
 * Ein Archiv entsteht aus einem Commit, nie aus einem Ordner im Finder. Damit
 * ist ausgeschlossen, was in v0.1 passiert ist: ein Projektordner mit
 * `node_modules/`, `.git/`, `dist/`, `.astro/` und `.DS_Store`, auf einer
 * anderen Maschine unbrauchbar und 134 MB groß.
 *
 * Das Skript erzeugt das Archiv mit `git archive` und prüft es danach:
 * kein installierter Zustand, keine generierten Dateien, keine Metadaten,
 * eine Lizenz.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const FORBIDDEN = [
  { re: /(^|\/)node_modules\//, why: 'installierte Abhängigkeiten' },
  { re: /(^|\/)\.git\//, why: 'Repository-interne Daten' },
  { re: /(^|\/)dist\//, why: 'Build-Ausgabe' },
  { re: /(^|\/)\.astro\//, why: 'generierte Dateien' },
  { re: /(^|\/)\.DS_Store$/, why: 'macOS-Metadaten' },
  { re: /^__MACOSX/, why: 'macOS-Archivmüll' },
];

const git = (args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' });

const name = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).name;
const version = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const dirty = git(['status', '--porcelain']).trim();
if (dirty) {
  console.error('✗ Arbeitsverzeichnis ist nicht sauber. Ein Release entsteht aus einem Commit:');
  console.error(dirty.split('\n').slice(0, 8).map((l) => `    ${l}`).join('\n'));
  process.exit(1);
}

const required = ['LICENSE', 'README.md', 'AGENTS.md', 'package-lock.json'];
const missing = required.filter((f) => !git(['ls-files', f]).trim());
if (missing.length) {
  console.error(`✗ fehlt im Commit: ${missing.join(', ')} — ohne Lizenz ist das kein offenes Template`);
  process.exit(1);
}

const out = path.join(path.dirname(ROOT), `${name}-${version}.tar.gz`);
git(['archive', '--format=tar.gz', `--prefix=${name}/`, '-o', out, 'HEAD']);

const listing = execFileSync('tar', ['-tzf', out], { encoding: 'utf8' }).split('\n').filter(Boolean);
const violations = [];
for (const entry of listing) {
  const hit = FORBIDDEN.find((f) => f.re.test(entry));
  if (hit) violations.push(`${entry} — ${hit.why}`);
}

const size = (statSync(out).size / 1024).toFixed(1);
if (violations.length) {
  console.error(`✗ Archiv enthält Unerwünschtes (${violations.length}):`);
  console.error(violations.slice(0, 10).map((v) => `    ${v}`).join('\n'));
  process.exit(1);
}

console.log(`Archiv: ${out}`);
console.log(`  ${listing.length} Einträge, ${size} kB, erzeugt aus ${git(['rev-parse', '--short', 'HEAD']).trim()}`);
console.log('  frei von node_modules, .git, dist, .astro und Metadaten');
