#!/usr/bin/env node
/**
 * Deterministische Checks für die LLM-CMS-Minimalvariante.
 *
 * Prüfschicht dieses Systems: rund 415 Zeilen, nur Node-Built-ins plus js-yaml.
 * Alles andere — Frontmatter-Schema, Build, Vorschau — liefert Astro. Geprüft wird,
 * was eine Werkzeugkette nicht von selbst erzwingt: Links, Assets, Navigation,
 * Erreichbarkeit, Vertrauensgrenze, Platzhalter, Geheimnisse.
 *
 *   node scripts/check.mjs source [--strict]   Zustand im Repository prüfen
 *   node scripts/check.mjs dist    [--strict]  Build-Ausgabe prüfen
 *
 * Regeln: AGENTS.md. Exit-Code 1 bei Fehlern, bei --strict auch bei Warnungen.
 * Keine Netzwerkzugriffe, keine Zeitstempel, kein Zufall: gleiche Eingabe,
 * gleiches Ergebnis.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { load } from 'js-yaml';

const ROOT = process.cwd();
const MODE = process.argv[2] ?? 'source';
const STRICT = process.argv.includes('--strict');

const errors = [];
const warnings = [];
const notes = [];

const err = (file, msg) => errors.push(`  ✗ ${file}: ${msg}`);
const warn = (file, msg) => warnings.push(`  ! ${file}: ${msg}`);
const note = (file, msg) => notes.push(`  · ${file}: ${msg}`);

/* ------------------------------- Helfer ---------------------------------- */

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs).sort()) {
    if (['node_modules', '.git', '.astro', 'dist'].includes(name) && dir !== 'dist') continue;
    const rel = dir ? `${dir}/${name}` : name;
    const st = statSync(path.join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const shaOf = (rel) => createHash('sha256').update(readFileSync(path.join(ROOT, rel))).digest('hex');

function frontmatterOf(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  try {
    return load(m[1]) ?? {};
  } catch (e) {
    return { __yamlError: e.message };
  }
}

/** Pfad einer Seite wie in src/lib/page.ts — hier gespiegelt, damit der
 *  Check ohne Build läuft. Regel R-10. */
function pathForPage(id, slug) {
  if (slug) return slug;
  const base = id.replace(/\.md$/, '');
  if (base === 'start' || base === 'index') return '/';
  return `/${base}/`;
}

const isPagePath = (target) => !/\.[a-z0-9]{2,5}$/i.test(target.split('?')[0]);

/** Vergleichbare Form eines Pfades: /leistungen/ und /leistungen ist dieselbe Seite. */
const canonical = (p) => (p ? (p === '/' ? '/' : p.replace(/\/+$/, '')) : p);

function linksInMarkdown(text) {
  const out = [];
  const re = /(!?)\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
  let m;
  while ((m = re.exec(text))) out.push({ image: m[1] === '!', alt: m[2], target: m[3], line: text.slice(0, m.index).split('\n').length });
  return out;
}

/**
 * Platzhalter-Konvention (AGENTS.md R-07): eckige Klammern mit Großbuchstaben am Anfang
 * oder ein klassischer Markierer. Markdown-Links [Text](ziel) sind keine Platzhalter.
 */
const PLACEHOLDER_MARKER = /\b(TODO|FIXME|XXX|lorem ipsum)\b/i;
function isPlaceholder(line, rel = '') {
  // Kommentarzeilen sind Anweisung an den Leser, kein Platzhalter.
  // In Markdown ist # eine Überschrift, deshalb dort nicht als Kommentar werten.
  if (!rel.endsWith('.md') && /^\s*(#|\/\/|\/\*)/.test(line)) return false;
  return /\[[A-ZÄÖÜ][^\]\n]{1,60}\](?!\()/.test(line) || PLACEHOLDER_MARKER.test(line);
}

/* ----------------------- Seitenbestand (Quelle) --------------------------- */

const PAGES_DIR = 'src/content/pages';
const pages = walk(PAGES_DIR).map((rel) => {
  const id = path.posix.relative(PAGES_DIR, rel);
  const text = read(rel);
  const fm = frontmatterOf(text);
  return { rel, id, text, fm, links: linksInMarkdown(text) };
});

const site = (() => {
  try {
    return load(read('site.yaml'));
  } catch (e) {
    err('site.yaml', `nicht lesbares YAML: ${e.message}`);
    return null;
  }
})();

/* ------------------------- Vertrauen: input/-Index ------------------------ */

const inputIndex = new Map();
for (const rel of walk('input')) {
  if (!inputIndex.has(shaOf(rel))) inputIndex.set(shaOf(rel), rel);
}

/* ============================== QUELLEN-CHECKS ============================ */

if (MODE === 'source') {
  // S1 — site.yaml: Struktur und Domain
  if (site) {
    for (const key of ['name', 'url', 'language', 'nav', 'footer']) {
      if (!(key in site)) err('site.yaml', `Pflichtfeld "${key}" fehlt (R-05)`);
    }
    if (site.url && !/^https:\/\/[^/]+[^/]?$/.test(site.url)) {
      err('site.yaml', `url muss https://… ohne abschließenden Slash sein, ist "${site.url}"`);
    }
    for (const list of ['nav', 'footer']) {
      const seen = new Set();
      for (const [i, item] of (site[list] ?? []).entries()) {
        const where = `site.yaml ${list}[${i}]`;
        if (!item?.label) err(where, 'label fehlt');
        if (!item?.href?.startsWith('/')) err(where, `href muss mit / beginnen, ist "${item?.href}"`);
        else if (item.href !== '/' && !item.href.endsWith('/')) warn(where, `href sollte auf / enden: "${item.href}"`);
        if (seen.has(canonical(item?.href))) err(where, `duplizierter href ${item.href}`);
        seen.add(item?.href);
      }
    }
  }

  // S2 — Seiten: Dateinamen, Frontmatter, Pfadkollisionen
  const byPath = new Map();
  for (const page of pages) {
    if (!/\.md$/.test(page.rel)) err(page.rel, 'nur Markdown als Seite erlaubt');
    const name = path.posix.basename(page.rel, '.md');
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name)) err(page.rel, 'Dateiname muss kleingeschriebener kebab-case sein (R-10)');
    if (!page.fm) {
      err(page.rel, 'Frontmatter fehlt — Vorlage: docs/seitenvorlage.md (R-06)');
      continue;
    }
    if (page.fm.__yamlError) err(page.rel, `Frontmatter-YAML fehlerhaft: ${page.fm.__yamlError}`);
    const { title, description, draft, noindex, slug } = page.fm;
    if (typeof title !== 'string' || title.trim().length < 2) err(page.rel, 'title fehlt (Pflicht, Schema in src/content.config.ts)');
    if (typeof description !== 'string' || description.trim().length < 20) err(page.rel, 'description fehlt oder zu kurz (20–200 Zeichen)');
    if (typeof description === 'string' && description.length > 200) warn(page.rel, `description ist ${description.length} Zeichen (Ziel: bis 200)`);
    for (const [key, value] of [['draft', draft], ['noindex', noindex]]) {
      if (value !== undefined && typeof value !== 'boolean') err(page.rel, `${key} muss true oder false sein`);
    }
    if (slug !== undefined && !/^\/[a-z0-9\/-]*$/.test(slug)) err(page.rel, `slug ungültig: ${slug}`);

    const p = pathForPage(page.id, slug);
    if (byPath.has(p)) err(page.rel, `URL-Kollision mit ${byPath.get(p)}: beide ergeben ${p}`);
    byPath.set(p, page.rel);
    page.path = p;
    page.draft = draft === true;

    // Inhaltsebene: Überschriften beginnen bei h2, h1 liefert das Layout.
    if (/^#\s+\S/m.test(page.text.replace(/^---\r?\n[\s\S]*?\r?\n---/, ''))) {
      warn(page.rel, 'enthält eine h1 — die Überschrift kommt aus dem Layout (R-06)');
    }
  }

  if (![...byPath.keys()].includes('/')) err(PAGES_DIR, 'keine Startseite: start.md (oder slug: /) fehlt (R-06)');

  // S3 — Nav-Ziele und interne Links
  // Verlinkbar sind nur veröffentlichte Seiten. Drafts existieren, dürfen aber
  // weder in der Navigation noch in einem Link landen (R-04, R-08).
  const published = new Map(pages.filter((p) => p.path && !p.draft).map((p) => [canonical(p.path), p]));
  const drafts = new Map(pages.filter((p) => p.path && p.draft).map((p) => [canonical(p.path), p]));
  for (const list of ['nav', 'footer']) {
    for (const item of site?.[list] ?? []) {
      const page = published.get(canonical(item.href));
      if (page) continue;
      const draft = drafts.get(canonical(item.href));
      if (draft) err('site.yaml', `${list} → ${item.href} zeigt auf eine Draft-Seite (${draft.rel})`);
      else err('site.yaml', `${list} → ${item.href} gehört zu keiner Seite unter ${PAGES_DIR}`);
    }
  }

  for (const page of pages) {
    if (!page.fm) continue;
    for (const link of page.links) {
      const t = link.target;
      if (link.image && !link.alt.trim()) warn(page.rel, `Bild ohne Alt-Text in Zeile ${link.line}: ${t} — beschreiben oder bewusst dekorativ lassen (R-11)`);
      if (/^(https?:|mailto:|tel:|data:)/i.test(t)) {
        if (/^http:\/\//i.test(t)) warn(page.rel, `unsicherer http-Link in Zeile ${link.line}: ${t}`);
        if (/localhost|127\.0\.0\.1/.test(t)) err(page.rel, `lokaler Link in Zeile ${link.line}: ${t} — veröffentlicht nicht`);
        continue;
      }
      if (t.startsWith('#')) continue;
      if (!t.startsWith('/')) {
        warn(page.rel, `relativer Link in Zeile ${link.line}: ${t} — intern immer absolut ab / schreiben (R-10)`);
        continue;
      }
      if (link.image || !isPagePath(t)) {
        const asset = `public${t}`;
        if (!existsSync(path.join(ROOT, asset))) err(page.rel, `Asset fehlt in Zeile ${link.line}: ${t} (erwartet unter ${asset})`);
      } else if (!published.has(canonical(t))) {
        const draftTarget = drafts.get(canonical(t));
        if (draftTarget) err(page.rel, `Link in Zeile ${link.line} auf Draft-Seite ${draftTarget.rel} — nicht veröffentlichtes Material bleibt unverlinkt (R-04)`);
        else err(page.rel, `toter interner Link in Zeile ${link.line}: ${t}`);
      }
    }
    if (page.draft) note(page.rel, 'Draft — erscheint nicht im Build');
  }

  // S4 — Vertrauensgrenze input/ (R-04)
  for (const forbidden of ['public/input', 'src/input', 'public/raw', 'src/assets/input']) {
    if (existsSync(path.join(ROOT, forbidden))) err(forbidden, 'Material aus input/ liegt im Auslieferungsbereich — Veröffentlichung nur nach Freigabe (R-04)');
  }
  for (const rel of [...walk('public'), ...walk('src')]) {
    const hit = inputIndex.get(shaOf(rel));
    if (hit) warn(rel, `byte-identisch mit ${hit} — Übernahme aus input/ im Commit-Message belegen (R-04)`);
  }
  // Wird zusammengesetzt, damit dieser Scanner nicht sich selbst meldet.
  const SECRET = new RegExp(`${'-'.repeat(5)}BEGIN [A-Z ]*PRIVATE KEY${'-'.repeat(5)}|(?:AKIA|glpat-|sk-)[A-Za-z0-9_-]{16,}`);
  const KEY_FILE = /(\.pem|\.key|\.p12|\.pfx|id_rsa|id_ed25519|^\.env)/i;
  const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|tar|bz2|7z|mp3|mp4|mov|woff2?|ttf|otf|eot|wasm|so|dylib|node)$/i;
  for (const rel of walk('.')) {
    if (KEY_FILE.test(path.posix.basename(rel)) || KEY_FILE.test(rel)) {
      err(rel, 'Schlüssel- oder Umgebungsdatei im Repository — niemals committen (R-04)');
      continue;
    }
    if (BINARY.test(rel)) continue;
    let text;
    try {
      if (statSync(path.join(ROOT, rel)).size > 512 * 1024) continue;
      text = read(rel);
    } catch {
      continue;
    }
    if (text.includes('\0')) continue; // Binärdatei
    const line = text.split('\n').findIndex((l) => SECRET.test(l));
    if (line >= 0) err(rel, `sieht nach einem Geheimnis aus (Zeile ${line + 1}) — aus dem Repo entfernen (R-04)`);
  }

  // S5 — Build-Hygiene: generierte Dateien bleiben draußen
  const gitignore = existsSync('.gitignore') ? read('.gitignore') : '';
  for (const generated of ['dist/', '.astro/']) {
    if (!gitignore.includes(generated)) err('.gitignore', `${generated} fehlt — generierte Dateien werden nicht committet (R-03)`);
  }
  if (existsSync('.git')) {
    try {
      const { execFileSync } = await import('node:child_process');
      const tracked = execFileSync('git', ['ls-files', 'dist', '.astro'], { cwd: ROOT, encoding: 'utf8' }).trim();
      if (tracked) err('git', `generierte Dateien sind committet: ${tracked.split('\n').slice(0, 3).join(', ')} (R-03)`);
    } catch {
      /* git nicht verfügbar — kein Fehler, der Check ist optional */
    }
  }

  // S6 — Kohärenz: jede Seite ist erreichbar (R-08)
  const linkedTargets = new Set();
  for (const page of pages) {
    if (page.draft) continue;
    for (const link of page.links) {
      if (link.target.startsWith('/') && isPagePath(link.target)) linkedTargets.add(canonical(link.target));
    }
  }
  // Startseite und rechtliche Seiten sind über Layout bzw. Fußzeile erreichbar.
  const navTargets = new Set([...(site?.nav ?? []), ...(site?.footer ?? [])].map((i) => canonical(i.href)));
  for (const page of pages) {
    if (page.draft || !page.path) continue;
    const target = canonical(page.path);
    if (target === '/' || navTargets.has(target) || linkedTargets.has(target)) continue;
    warn(page.rel, `von keiner Navigation und keiner anderen Seite verlinkt: ${page.path} (R-08)`);
  }
  if (![...published.keys()].some((p) => /impressum/i.test(p))) {
    warn(PAGES_DIR, 'keine Impressums-Seite — rechtliche Pflichtangaben brauchen eine eigene Seite (R-13)');
  }

  // S7 — Platzhalter: eine Warnung pro Datei, vollständig mit Zeilennummern
  const found = new Map();
  for (const rel of [...walk('src'), 'site.yaml']) {
    if (!/\.(md|ya?ml|astro|css|ts)$/.test(rel)) continue;
    const lines = read(rel).split('\n').map((l, i) => (isPlaceholder(l, rel) ? i + 1 : 0)).filter(Boolean);
    if (lines.length) found.set(rel, lines);
  }
  for (const [rel, lines] of [...found].sort()) {
    warn(rel, `${lines.length} Platzhalter in Zeile${lines.length > 1 ? 'n' : ''} ${lines.join(', ')} — ersetzen oder bewusst stehen lassen (R-07)`);
  }
  if (found.size === 0) note('—', 'keine Platzhalter im Quellenzustand');
}

/* ============================== BUILD-CHECKS ============================== */

if (MODE === 'dist') {
  if (!existsSync('dist')) {
    err('dist', 'Build-Ausgabe fehlt — zuerst npm run build');
  } else {
    const files = walk('dist');
    const html = files.filter((f) => f.endsWith('.html'));

    for (const bad of ['.astro', 'node_modules', 'site.yaml', 'src']) {
      if (files.some((f) => f === `dist/${bad}` || f.startsWith(`dist/${bad}/`))) err('dist', `enthält ${bad} — es gehören nur ausgelieferte Dateien hinein`);
    }

    // D1 — jede veröffentlichte Seite liegt vor, jede Draft-Seite nicht
    for (const page of pages) {
      const fm = page.fm ?? {};
      const target = pathForPage(page.id, fm.slug).replace(/^\//, '');
      const expected = `dist/${target}index.html`;
      if (fm.draft === true) {
        if (existsSync(path.join(ROOT, expected))) err(page.rel, `Draft-Seite wurde veröffentlicht (${expected}) — Vertrauensgrenze (R-04)`);
      } else if (!existsSync(path.join(ROOT, expected))) {
        err(page.rel, `Seite fehlt im Build: erwartet wurde ${expected}`);
      }
    }

    // D2 — tote interne Links und fehlende Assets im fertigen HTML
    const seen = new Set();
    for (const rel of html) {
      const text = read(rel);
      const dir = path.posix.dirname(rel);
      const re = /(?:href|src|action)=["']([^"']+)["']/gi;
      let m;
      while ((m = re.exec(text))) {
        const target = m[1];
        if (/^(https?:|mailto:|tel:|data:|#|\/\/)/i.test(target)) continue;
        const clean = target.split(/[?#]/)[0];
        if (!clean) continue;
        const resolved = clean.startsWith('/')
          ? path.posix.normalize(`dist/${clean}`)
          : path.posix.normalize(`${dir}/${clean}`);
        const asFile = existsSync(path.join(ROOT, resolved));
        const asDir = existsSync(path.join(ROOT, `${resolved.replace(/\/$/, '')}/index.html`));
        if (!asFile && !asDir) {
          const key = `${rel} → ${target}`;
          if (!seen.has(key)) {
            seen.add(key);
            err(rel, `totes Ziel: ${target}`);
          }
        }
      }
      if (text.length === 0) err(rel, 'leere Datei');
    }

    // D3 — Grundausstattung jeder Seite
    for (const rel of html) {
      const text = read(rel);
      if (!/<title>[^<]{2,}<\/title>/i.test(text)) err(rel, 'kein <title>');
      if (!/<html[^>]*\slang=/i.test(text)) err(rel, '<html> ohne lang (R-11)');
      const h1 = (text.match(/<h1[\s>]/gi) ?? []).length;
      if (h1 !== 1) err(rel, `${h1} <h1> — genau eines, und es kommt aus dem Layout (R-11)`);
      if (!/name=["']description["']/i.test(text)) warn(rel, 'keine Meta-Beschreibung');
      if (!/rel=["']canonical["']/i.test(text)) warn(rel, 'kein kanonischer Link');
    }

    // D4 — Vertrauensgrenze: kein Byte aus input/ im Auslieferungszustand
    for (const rel of files) {
      const hit = inputIndex.get(shaOf(rel));
      if (hit) err(rel, `Inhalt stammt aus ${hit} — Material aus input/ wird nicht unverändert veröffentlicht (R-04)`);
    }

    // D5 — Sitemap und robots.txt
    if (existsSync('dist/sitemap.xml')) {
      const xml = read('dist/sitemap.xml');
      if (!xml.includes('<urlset')) err('dist/sitemap.xml', 'kein gültiges urlset');
      const count = (xml.match(/<loc>/g) ?? []).length;
      const expectedCount = pages.filter((p) => p.fm && p.fm.draft !== true && p.fm.noindex !== true).length;
      if (count !== expectedCount) warn('dist/sitemap.xml', `${count} Einträge, erwartet ${expectedCount} veröffentlichte Seiten`);
    } else {
      warn('dist', 'sitemap.xml fehlt');
    }
    if (existsSync('dist/robots.txt')) {
      const robots = read('dist/robots.txt');
      const sm = /Sitemap:\s*(\S+)/i.exec(robots);
      if (sm && site?.url && !sm[1].startsWith(site.url)) warn('dist/robots.txt', `Sitemap-URL passt nicht zu site.yaml url=${site.url}: ${sm[1]}`);
    } else {
      warn('dist', 'robots.txt fehlt');
    }

    // D6 — Platzhalter im fertigen Output
    let hits = 0;
    for (const rel of html) {
      const lines = read(rel).split('\n').map((l, i) => (isPlaceholder(l) ? i + 1 : 0)).filter(Boolean);
      if (lines.length) {
        hits += lines.length;
        warn(rel, `${lines.length} Platzhalter im ausgelieferten HTML`);
      }
    }
    if (hits) note('—', `${hits} Platzhalter im Build — vor dem Livegang ersetzen (check:strict blockiert)`);
    else note('—', `${html.length} Seiten ohne Platzhalter gebaut`);
  }
}

/* ================================ Ausgabe ================================= */

console.log(`check ${MODE} — ${pages.length} Seiten, ${inputIndex.size} Dateien in input/`);
if (errors.length) console.log(`\nFEHLER (${errors.length}):\n${errors.sort().join('\n')}`);
if (warnings.length) console.log(`\nWARNUNGEN (${warnings.length}):\n${warnings.sort().join('\n')}`);
if (notes.length) console.log(`\nNOTIZEN (${notes.length}):\n${notes.sort().join('\n')}`);

const blocked = errors.length > 0 || (STRICT && warnings.length > 0);
console.log(
  blocked
    ? `\nErgebnis: BLOCKIERT — ${errors.length} Fehler, ${warnings.length} Warnungen. Reparen und erneut prüfen.`
    : `\nErgebnis: OK — ${errors.length} Fehler, ${warnings.length} Warnungen.`,
);
process.exit(blocked ? 1 : 0);
