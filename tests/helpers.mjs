/**
 * Test-Helfer.
 *
 * Der Validator nimmt das Arbeitsverzeichnis als Eingabe. Ein Test braucht
 * deshalb kein Setup aus Shell, rsync oder sed: Kopie in ein temporäres
 * Verzeichnis, Änderung mit Node-Dateifunktionen, Validator als Prozess mit
 * cwd = Fixture. Kein geteiltes Arbeitsverzeichnis, kein Zustand zwischen Tests,
 * keine Abhängigkeit von bash, mktemp oder sed-Dialekten.
 *
 * Jeder Negativtest verlangt Exit-Code 1 UND die erwartete Diagnose (Code,
 * Datei, Zeile). Ein Setup-Fehler kann damit nicht mehr als Erfolg durchgehen —
 * das war der Fehler des v0.1-Selbsttests.
 */

import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..');
export const CHECK = path.join(REPO, 'scripts/check.mjs');
const BASE = path.join(REPO, 'tests/fixtures/base');

/**
 * Material in `input/` wird für Tests erzeugt, nicht committet — im echten
 * Projekt ist es standardmäßig ignoriert (R-04), und ein Testdatenblatt im Repo
 * wäre genau der Fehler, den die Regel verhindert.
 */
export const MATERIAL = 'Umsatz 2026: 4711 Euro\n';
export const MATERIAL_REL = 'input/documents/profil.pdf';

/** Kopie der Basis-Fixture; wird nach dem Test entfernt. */
export function fixture(t, mutate) {
  const dir = mkdtempSync(path.join(tmpdir(), 'llm-cms-'));
  cpSync(BASE, dir, { recursive: true });
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  write(dir, 'input/README.md', 'Ablage für Rohtext. Diese Dateien sind privat by default.\n');
  write(dir, MATERIAL_REL, MATERIAL);
  if (mutate) mutate(dir);
  return dir;
}

export function write(dir, rel, content) {
  const target = path.join(dir, rel);
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, content);
}

/** Text anhängen. Die neue Zeile bekommt die nächste Zeilennummer. */
export function append(dir, rel, text) {
  const target = path.join(dir, rel);
  const current = readFileSync(target, 'utf8');
  const base = current.endsWith('\n') ? current : `${current}\n`;
  writeFileSync(target, base + text.replace(/^\n+/, ''));
}

export function patch(dir, rel, search, replacement) {
  const target = path.join(dir, rel);
  const text = readFileSync(target, 'utf8');
  if (!text.includes(search)) throw new Error(`Fixture-Hinweis fehlt: "${search}" in ${rel}`);
  writeFileSync(target, text.replace(search, replacement));
}

export function remove(dir, rel) {
  rmSync(path.join(dir, rel), { recursive: true, force: true });
}

export function exists(dir, rel) {
  return existsSync(path.join(dir, rel));
}

/**
 * Validator starten.
 * @returns {{ code: number|null, json: object|null, stdout: string, stderr: string }}
 */
export function run(dir, mode = 'source', args = [], env = {}) {
  const res = spawnSync(process.execPath, [CHECK, mode, '--json', ...args], {
    cwd: dir,
    encoding: 'utf8',
    env: { ...process.env, ...env },
  });
  let json = null;
  try {
    json = JSON.parse(res.stdout);
  } catch {
    /* Absicht: Diagnose unten */
  }
  return { code: res.status, json, stdout: res.stdout, stderr: res.stderr };
}

export function diagnostics(res, code) {
  return (res.json?.diagnostics ?? []).filter((d) => d.code === code);
}

/** Keine Stacktrace-Ausgabe: ungültige Eingabe erzeugt Diagnosen, keine Abstürze. */
function assertNoCrash(res, label) {
  const crash = /TypeError|ReferenceError|SyntaxError|\n\s+at .*\(.*:\d+:\d+\)/.test(`${res.stderr}${res.stdout}`);
  if (crash) throw new Error(`${label}: Validator ist abgestürzt\n${res.stderr}\n${res.stdout}`);
}

/**
 * Negativtest: blockiert, und zwar wegen der erwarteten Diagnosen.
 * @param {{ code: string, file?: string, line?: number, severity?: string }[]} expected
 */
export function assertBlocked(res, expected, label = 'Negativtest') {
  assertNoCrash(res, label);
  if (res.code !== 1) throw new Error(`${label}: erwartet Exit 1, erhalten ${res.code}\n${res.stdout}`);
  if (!res.json) throw new Error(`${label}: keine JSON-Diagnose\n${res.stdout}\n${res.stderr}`);
  if (res.json.ok !== false) throw new Error(`${label}: ok sollte false sein`);
  for (const want of expected) {
    const hits = diagnostics(res, want.code);
    if (hits.length === 0) {
      const seen = res.json.diagnostics.map((d) => `${d.severity}:${d.code}@${d.file}`).join('\n    ');
      throw new Error(`${label}: Diagnose ${want.code} fehlt. Gefunden:\n    ${seen}`);
    }
    const match = hits.find(
      (d) =>
        (want.file === undefined || d.file === want.file || d.file.endsWith(want.file)) &&
        (want.line === undefined || d.line === want.line) &&
        (want.severity === undefined || d.severity === want.severity),
    );
    if (!match) {
      const seen = hits.map((d) => `${d.severity}:${d.file}:${d.line ?? '-'}`).join('\n    ');
      throw new Error(
        `${label}: ${want.code} gefunden, aber an anderer Stelle — erwartet ${want.file ?? 'gleich'}:${want.line ?? 'gleich'}:${want.severity ?? 'gleich'}\n    ${seen}`,
      );
    }
  }
}

/**
 * Positivtest: nichts blockiert, und keine der genannten Codes ist vorhanden.
 * Warnungen sind erlaubt, außer `allowWarnings: false`.
 */
export function assertClean(res, { allowWarnings = true, absent = [] } = {}, label = 'Positivtest') {
  assertNoCrash(res, label);
  if (res.code !== 0) {
    const errs = (res.json?.diagnostics ?? []).filter((d) => d.severity === 'error').map((d) => `    ${d.code} ${d.file} — ${d.message}`);
    throw new Error(`${label}: erwartet Exit 0, erhalten ${res.code}\n${errs.join('\n')}\n${res.stdout}`);
  }
  for (const code of absent) {
    if (diagnostics(res, code).length) throw new Error(`${label}: ${code} war nicht erwartet`);
  }
  if (!allowWarnings) {
    const warns = (res.json?.diagnostics ?? []).filter((d) => d.severity === 'warning').map((d) => `    ${d.code} ${d.file} — ${d.message}`);
    if (warns.length) throw new Error(`${label}: unerwartete Warnungen:\n${warns.join('\n')}`);
  }
}

/**
 * Warnungsfall: nichts blockiert, aber die erwartete Warnung ist da. Der
 * Unterschied zum Fehler ist eine Entscheidung, kein Zufall (AGENTS.md R-16).
 */
export function assertWarns(res, expected, label = 'Warnung') {
  assertNoCrash(res, label);
  if (res.code !== 0) throw new Error(`${label}: erwartet Exit 0, erhalten ${res.code}\n${res.stdout}`);
  for (const want of expected) {
    const hits = diagnostics(res, want.code);
    if (hits.length === 0) {
      const seen = (res.json?.diagnostics ?? []).map((d) => `${d.severity}:${d.code}@${d.file}`).join('\n    ');
      throw new Error(`${label}: Warnung ${want.code} fehlt. Gefunden:\n    ${seen}`);
    }
    const match = hits.find(
      (d) =>
        (want.file === undefined || (d.file ?? '').endsWith(want.file)) &&
        (want.severity === undefined || d.severity === want.severity),
    );
    if (!match) throw new Error(`${label}: ${want.code} an anderer Stelle — erwartet ${JSON.stringify(want)}`);
  }
}

/* ------------------------- Build-Ausgabe (dist) --------------------------- */

export function pageHtml({ title = 'Seite', lang = 'de', robots = 'noindex, nofollow', description = true, canonical = true, h1 = 1, body = '<p>Text</p>' } = {}) {
  return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8">
<title>${title}</title>
${description ? '<meta name="description" content="Eine hinreichend lange Beschreibung der Seite.">' : ''}
${canonical ? '<link rel="canonical" href="https://acme.example/">' : ''}
<meta name="robots" content="${robots}">
</head><body><main>${'<h1>Überschrift</h1>'.repeat(h1)}${body}</main></body></html>
`;
}

/**
 * Minimale, regelkonforme Build-Ausgabe für die Seiten der Basis-Fixture.
 * @param {Record<string, string|null>} changes  Route → HTML oder null (Seite fehlt)
 */
export function writeDist(dir, changes = {}, extra = {}) {
  const routes = { '/': 'start', '/leistungen/': 'leistungen', '/kontakt/': 'kontakt', '/impressum/': 'impressum' };
  const distDir = path.join(dir, 'dist');
  for (const [route, name] of Object.entries(routes)) {
    if (route in changes) {
      if (changes[route] === null) continue;
      write(dir, `dist/${route === '/' ? 'index.html' : `${route.slice(1)}index.html`}`, changes[route]);
      continue;
    }
    write(dir, `dist/${route === '/' ? 'index.html' : `${route.slice(1)}index.html`}`, pageHtml({ title: name }));
  }
  write(
    dir,
    'dist/robots.txt',
    extra.robots ?? ['User-agent: *', 'Disallow: /', '', '# lifecycle: development'].join('\n'),
  );
  write(
    dir,
    'dist/sitemap.xml',
    extra.sitemap ??
      `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(routes)
        .map((r) => `  <url><loc>https://acme.example${r}</loc></url>`)
        .join('\n')}\n</urlset>\n`,
  );
  return distDir;
}

/** git in der Fixture (für Tests, die die Dateiliste brauchen). */
export function git(dir, args) {
  const res = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  if (res.status !== 0) throw new Error(`git ${args.join(' ')} fehlgeschlagen: ${res.stderr}`);
  return res.stdout;
}
