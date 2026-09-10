#!/usr/bin/env node
/**
 * Reproducierbarkeits-Nachweis (R-12): zweimal sauber bauen und die Ausgabe
 * Byte für Byte vergleichen. Gleiche Quelle muss gleiche Website bedeuten.
 *
 *   npm run reproducible
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

function files(dir) {
  const out = [];
  const abs = path.join(process.cwd(), dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs).sort()) {
    const rel = `${dir}/${name}`;
    const st = statSync(path.join(process.cwd(), rel));
    if (st.isDirectory()) out.push(...files(rel));
    else out.push(rel);
  }
  return out;
}

function buildAndHash() {
  rmSync('dist', { recursive: true, force: true });
  execFileSync('npx', ['astro', 'build'], { stdio: 'ignore' });
  const map = new Map();
  for (const rel of files('dist')) {
    map.set(rel, createHash('sha256').update(readFileSync(path.join(process.cwd(), rel))).digest('hex'));
  }
  return map;
}

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

if (problems.length) {
  console.log(`\nNICHT reproducierbar (${problems.length} Abweichungen):`);
  console.log(problems.sort().map((p) => `  ✗ ${p}`).join('\n'));
  console.log('\nUrsache meist: Zeitstempel, Zufall, Netzwerkzugriff oder Instabilität im Build (AGENTS.md R-12).');
  process.exit(1);
}

console.log(`\nReproduzierbar: ${first.size} Dateien, beide Builds byte-identisch.`);
