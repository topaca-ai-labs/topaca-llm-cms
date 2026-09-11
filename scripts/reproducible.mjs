#!/usr/bin/env node
/**
 * Nachweis der Wiederholbarkeit (AGENTS.md R-12).
 *
 *   npm run reproducible
 *
 * Was bewiesen wird: zwei Builds derselben Quelle in derselben Umgebung
 * (derselbe Node, derselbe Lockfile, dieselben installierten Abhängigkeiten)
 * erzeugen byte-identische Ausgabe.
 *
 * Was damit NICHT behauptet wird: gleiches Ergebnis auf einem anderen
 * Betriebssystem, einer anderen Node-Version oder einer Installation in drei
 * Jahren. Dafür ist die Umgebung selbst der Gegenstand: `.node-version`,
 * `packageManager` und `package-lock.json` fixieren sie; ein
 * Umgebungsübergleich wäre eine eigene Aufgabe (docs/architecture.md).
 *
 * Kein npx: das lokale Binary wird aufgerufen, damit niemand im Nachhinein
 * Software aus dem Netzwerk zieht.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const ASTRO = path.join(ROOT, 'node_modules', '.bin', process.platform === 'win32' ? 'astro.cmd' : 'astro');

if (!existsSync(ASTRO)) {
  console.error('✗ lokales Astro-Binary fehlt — zuerst npm ci (kein npx, kein Netzwerk: R-12)');
  process.exit(1);
}

function files(dir) {
  const out = [];
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs).sort()) {
    const rel = `${dir}/${name}`;
    const st = statSync(path.join(ROOT, rel));
    if (st.isDirectory()) out.push(...files(rel));
    else out.push(rel);
  }
  return out;
}

function buildAndHash() {
  rmSync(path.join(ROOT, 'dist'), { recursive: true, force: true });
  execFileSync(ASTRO, ['build'], { cwd: ROOT, stdio: 'ignore' });
  const map = new Map();
  for (const rel of files('dist')) {
    map.set(rel, createHash('sha256').update(readFileSync(path.join(ROOT, rel))).digest('hex'));
  }
  return map;
}

const lockHash = createHash('sha256').update(readFileSync(path.join(ROOT, 'package-lock.json'))).digest('hex').slice(0, 12);

console.log('Build 1 …');
const first = buildAndHash();
console.log('Build 2 …');
const second = buildAndHash();

const problems = [];
for (const [rel, hash] of first) {
  if (!second.has(rel)) problems.push(`nur in Build 1: ${rel}`);
  else if (second.get(rel) !== hash) problems.push(`unterschiedlich: ${rel}`);
}
for (const rel of second.keys()) if (!first.has(rel)) problems.push(`nur in Build 2: ${rel}`);

const umgebung = `Node ${process.version}, Lockfile ${lockHash}`;
if (problems.length) {
  console.log(`\nNICHT wiederholbar (${problems.length} Abweichungen):`);
  console.log(problems.sort().map((p) => `  ✗ ${p}`).join('\n'));
  console.log('\nUrsache meist: Zeitstempel, Zufall, Netzwerkzugriff oder Instabilität im Build (AGENTS.md R-12).');
  process.exit(1);
}

console.log(`\nWiederholbar: ${first.size} Dateien, beide Builds byte-identisch (${umgebung}).`);
console.log('Aussage gilt für diese Umgebung. Cross-Environment-Reproduzierbarkeit ist nicht behauptet (docs/architecture.md).');
