#!/usr/bin/env node
/**
 * Erzeugt ein Release-Archiv aus einem Commit — nicht aus dem Arbeitsverzeichnis.
 *
 * Ein Archiv, das versehentlich `node_modules/` enthält (79 MB, 22.000 Dateien),
 * ist kein Template. Deshalb: `git archive` aus einem sauberen Commit, danach
 * den Inhalt prüfen. Veröffentlichen bleibt ein Schritt des Menschen (R-20).
 */
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, '.release'); // gitignored, überlebt einen Build
const REQUIRED = ['LICENSE', 'README.md', 'AGENTS.md', 'package-lock.json'];
const FORBIDDEN = [/^node_modules\//, /^\.git\//, /^dist\//, /^\.astro\//, /\.DS_Store$/, /^__MACOSX/];

function fail(msg) {
  console.error(`\nRelease-Archiv blockiert: ${msg}`);
  process.exit(1);
}

function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (e) {
    fail(`git ${args.join(' ')} schlug fehl: ${e.stderr ?? e.message}`);
  }
}

if (!git('rev-parse', '--is-inside-work-tree')) fail('kein Git-Repository');
const dirty = git('status', '--porcelain');
if (dirty) fail(`Arbeitsverzeichnis ist nicht sauber — das Archiv kommt aus einem Commit:\n${dirty}`);

const commit = git('rev-parse', '--short', 'HEAD');
const tracked = new Set(git('ls-files').split('\n'));
const missing = REQUIRED.filter((f) => !tracked.has(f));
if (missing.length) fail(`Pflichtdateien nicht committet: ${missing.join(', ')}`);

const version = JSON.parse(git('show', 'HEAD:package.json')).version ?? 'dev';
const prefix = `llm-cms-${version}-${commit}`;
const archive = path.join(OUT_DIR, `${prefix}.tar.gz`);

mkdirSync(OUT_DIR, { recursive: true });
rmSync(archive, { force: true });
git('archive', '--format=tar.gz', `--prefix=${prefix}/`, '-o', archive, 'HEAD');

// Der Inhalt entscheidet, nicht die Absicht.
const listing = execFileSync('tar', ['-tzf', archive], { cwd: ROOT, encoding: 'utf8' })
  .split('\n')
  .filter(Boolean);
const roots = new Set(listing.map((n) => n.split('/')[0]));
if (roots.size !== 1) fail(`Archiv hat ${roots.size} Wurzelverzeichnisse, erwartet wird eines: ${[...roots].join(', ')}`);

const rel = (n) => n.replace(/^[^/]+\//, '');
const offenders = listing.filter((n) => FORBIDDEN.some((re) => re.test(rel(n))));
if (offenders.length) fail(`Archiv enthält Unerwünschtes: ${offenders.slice(0, 5).join(', ')}`);
for (const req of REQUIRED) {
  if (!listing.some((n) => rel(n) === req)) fail(`Archiv enthält nicht ${req}`);
}
if (listing.some((n) => rel(n).startsWith('../') || n.startsWith('/'))) fail('Archiv enthält Pfade außerhalb der Wurzel');

const bytes = readFileSync(archive);
console.log(`\nArchiv: ${archive}`);
console.log(`  ${listing.length} Einträge, ${(statSync(archive).size / 1024).toFixed(1)} kB, erzeugt aus ${commit}`);
console.log(`  Wurzel: ${[...roots][0]}/ — frei von node_modules, .git, dist, .astro und Metadaten`);
console.log(`  sha256: ${createHash('sha256').update(bytes).digest('hex')}`);
console.log('  Prüfen: tar -tzf <archiv> · Veröffentlichen ist ein eigener Schritt (R-20)');
