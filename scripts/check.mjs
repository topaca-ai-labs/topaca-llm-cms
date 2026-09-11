#!/usr/bin/env node
/**
 * Validator der LLM-CMS-Minimalvariante (AGENTS.md).
 *
 *   node scripts/check.mjs source [--strict] [--release] [--json]
 *   node scripts/check.mjs dist   [--strict] [--release] [--json]
 *
 * Grundsätze:
 *   Fail-closed.  Ein unbekannter Modus ist ein Fehler mit Exit-Code 2, kein
 *                 Durchlauf ohne Prüfung. Ungültige Eingabe erzeugt eine
 *                 benannte Diagnose, niemals einen Stacktrace.
 *   Eine Autorität. Routen kommen aus src/lib/route.mjs, das site.yaml-Schema
 *                 aus src/lib/site-schema.mjs — dieselben Quellen wie der Renderer.
 *   Schweregrade. MUST = error, SHOULD = warning, INFO = note. Regeln, die vom
 *                 Lebenszyklus abhängen (Platzhalter), sind im development-Zustand
 *                 eine Warnung und im production-Zustand ein Fehler — sichtbar
 *                 als dieselbe Code.
 *   Maschinell lesbar. --json liefert Diagnoseobjekte für den Reparatur-Loop.
 *
 * Exit-Codes: 0 = frei, 1 = blockiert, 2 = Aufruf- oder Eingabefehler des Validators.
 * Keine Netzwerkzugriffe, keine Zeitstempel, kein Zufall.
 */

import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { load } from 'js-yaml';
import { parseSite } from '../src/lib/site-schema.mjs';
import {
  SEGMENT_RE,
  canonical,
  invalidSegments,
  isHomeId,
  isPagePath,
  outputFileFor,
  RESERVED_IDS,
  routeForPage,
  splitTarget,
} from '../src/lib/route.mjs';

const ROOT = process.cwd();
const argv = process.argv.slice(2);
const MODE = argv.find((a) => !a.startsWith('--')) ?? 'source';
const STRICT = argv.includes('--strict');
const RELEASE = argv.includes('--release');
const JSON_OUT = argv.includes('--json');

/* ------------------------- Aufruf: fail-closed ---------------------------- */

const VALID_MODES = ['source', 'dist'];
if (!VALID_MODES.includes(MODE)) {
  const payload = {
    ok: false,
    mode: MODE,
    summary: { errors: 1, warnings: 0, notes: 0 },
    diagnostics: [
      {
        severity: 'error',
        code: 'UNKNOWN_MODE',
        rule: 'R-12',
        file: 'scripts/check.mjs',
        message: `unbekannter Modus "${MODE}" — geprüft wird nur ${VALID_MODES.join(' oder ')}`,
        hint: 'node scripts/check.mjs source   |   node scripts/check.mjs dist',
      },
    ],
  };
  if (process.argv.includes('--json')) process.stdout.write(`${JSON.stringify(payload, null, 2)}
`);
  else {
    console.error(`✗ UNKNOWN_MODE scripts/check.mjs — ${payload.diagnostics[0].message}`);
    console.error(`  ${payload.diagnostics[0].hint}`);
  }
  process.exit(2); // 2 = der Validator wurde nicht korrekt aufgerufen, nichts wurde geprüft
}

/* --------------------------- Diagnose-Schicht ----------------------------- */

const diagnostics = [];

/** @param {'error'|'warning'|'note'} severity */
function diag(severity, code, rule, file, message, extra = {}) {
  diagnostics.push({ severity, code, rule, file, message, ...extra });
}
const error = (code, rule, file, message, extra) => diag('error', code, rule, file, message, extra);
const warn = (code, rule, file, message, extra) => diag('warning', code, rule, file, message, extra);
const note = (code, rule, file, message, extra) => diag('note', code, rule, file, message, extra);

/**
 * Lebenszyklus-abhängige Regel: im production-Zustand ein Fehler, sonst eine
 * Warnung. Dieselbe Code, damit der Reparatur-Loop sieht, woran es liegt.
 */
let lifecycle = 'development';
const gate = (code, rule, file, message, extra) =>
  lifecycle === 'production' ? error(code, rule, file, message, extra) : warn(code, rule, file, message, extra);

/* ------------------------------- Helfer ---------------------------------- */

function walk(dir, out = []) {
  const abs = path.join(ROOT, dir);
  if (!existsSync(abs)) return out;
  for (const name of readdirSync(abs).sort()) {
    if (dir !== 'dist' && ['node_modules', '.git', '.astro', 'dist'].includes(name)) continue;
    const rel = `${dir}/${name}`;
    const st = statSync(path.join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out);
    else out.push(rel);
  }
  return out;
}

const read = (rel) => readFileSync(path.join(ROOT, rel), 'utf8');
const shaOf = (rel) => createHash('sha256').update(readFileSync(path.join(ROOT, rel))).digest('hex');

/** git-Ausgabe oder null, wenn kein Repository erreichbar ist. Kein Fehler: */
/**
 * git ohne Shell: Argumente als Liste, kein String, der interpoliert wird. Ein
 * Basis-Ref aus einer CI-Umgebungsvariable ist Eingabe — und Eingabe wird nicht
 * zur Shell-Befehlssyntax (R-18, docs/security.md).
 */
function git(...args) {
  try {
    return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

/**
 * Geänderte Dateien gegen einen Basis-Ref (CI). Der Ref kommt aus einer
 * Umgebungsvariable und ist damit Eingabe: er muss wie ein Ref aussehen, und ein
 * unlesbarer Ref ist eine Diagnose, kein Absturz und kein stiller Erfolg.
 */
function baseRefFiles() {
  const base = (process.env.CHECK_BASE_REF ?? '').trim();
  if (!base) return [];
  if (!/^[A-Za-z0-9._/-]+$/.test(base)) {
    warn('BASE_REF_INVALID', 'R-19', '—', `CHECK_BASE_REF ist kein gültiger Ref-Name: ${base}`, { hint: 'erwartet z. B. origin/main' });
    return [];
  }
  if (git('rev-parse', '--verify', '--quiet', `${base}^{commit}`) === null) {
    warn('BASE_REF_UNKNOWN', 'R-19', '—', `CHECK_BASE_REF ${base} existiert nicht in diesem Clone`, {
      hint: 'CI muss mit fetch-depth: 0 auschecken, sonst fehlt die Basis',
    });
    return [];
  }
  return (git('diff', '--name-only', `${base}...HEAD`) ?? '').split('\n').filter(Boolean);
}

function frontmatterOf(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  try {
    return { data: load(m[1]) ?? {} };
  } catch (e) {
    return { error: e.message };
  }
}

function linksInMarkdown(text) {
  const out = [];
  const re = /(!?)\[([^\]]*)\]\(\s*([^)\s]+)(?:\s+"[^"]*")?\s*\)/g;
  let m;
  while ((m = re.exec(text))) {
    out.push({
      image: m[1] === '!',
      alt: m[2],
      target: m[3],
      line: text.slice(0, m.index).split('\n').length,
    });
  }
  return out;
}

/**
 * Platzhalter-Konvention (R-07): eckige Klammern mit Großbuchstaben oder ein
 * klassischer Markierer. Markdown-Links [Text](ziel) sind keine Platzhalter.
 */
const PLACEHOLDER_MARKER = /\b(TODO|FIXME|XXX|lorem ipsum)\b/i;
function isPlaceholder(line, rel = '') {
  // In Markdown ist # eine Überschrift, deshalb dort nicht als Kommentar werten.
  if (!rel.endsWith('.md') && /^\s*(#|\/\/|\/\*)/.test(line)) return false;
  return /\[[A-ZÄÖÜ][^\]\n]{1,60}\](?!\()/.test(line) || PLACEHOLDER_MARKER.test(line);
}

function placeholderLines(rel) {
  return read(rel)
    .split('\n')
    .map((line, i) => (isPlaceholder(line, rel) ? i + 1 : 0))
    .filter(Boolean);
}

/* -------------------- Markdown ist Inhalt, kein Code ---------------------- */

// Astro lässt HTML in Markdown zu. Markdown ist deshalb keine Sandbox. Diese
// Website-Regel (R-18, R-22) verbietet ausführbare und eingebettete Konstrukte,
// solange sie nicht ausdrücklich freigegeben sind.
const UNSAFE_MARKDOWN = [
  { re: /<\s*script/i, why: '<script> — Markdown ist Inhalt, kein ausführbarer Code' },
  { re: /<\s*iframe/i, why: '<iframe> — Fremdeinbettung ist freizugeben' },
  { re: /<\s*object|<\s*embed/i, why: '<object>/<embed> — Fremdeinhalt' },
  { re: /<\s*form/i, why: '<form> — diese Website ist statisch, Formulare sind Rückstand' },
  { re: /javascript\s*:/i, why: 'javascript:-URL' },
  { re: /data:\s*text\/html/i, why: 'data:text/html' },
  { re: /\son(click|load|error|mouse\w+|focus|submit)\s*=\s*["']/i, why: 'Inline-Event-Handler' },
];

/**
 * Zielpfad eines Asset-Links als Dateipfad unter public/. Assets sind keine
 * Seiten: ihre Route wird nicht normalisiert, nur doppelte Schrägstriche fallen
 * weg. Die Segmentprüfung läuft getrennt (R-10).
 */
function publicPath(target) {
  const clean = target.replace(/\/{2,}/g, '/');
  return `public${clean.startsWith('/') ? clean : `/${clean}`}`;
}

function unsafeMarkdownLines(text) {
  const hits = [];
  text.split('\n').forEach((line, i) => {
    for (const rule of UNSAFE_MARKDOWN) {
      if (rule.re.test(line)) hits.push({ line: i + 1, why: rule.why });
    }
  });
  return hits;
}

/* ------------------------- Seitenbestand (Quelle) ------------------------- */

const PAGES_DIR = 'src/content/pages';

const pages = walk(PAGES_DIR).map((rel) => {
  const id = path.posix.relative(PAGES_DIR, rel);
  const text = read(rel);
  const fm = frontmatterOf(text);
  return { rel, id, text, data: fm?.data, fmError: fm?.error, links: linksInMarkdown(text) };
});

const inputIndex = new Map();
for (const rel of walk('input')) {
  const hash = shaOf(rel);
  if (!inputIndex.has(hash)) inputIndex.set(hash, rel);
}

/* ------------------------------- site.yaml -------------------------------- */

let site = null;
{
  let raw;
  if (!existsSync(path.join(ROOT, 'site.yaml'))) {
    error('SITE_YAML_MISSING', 'R-05', 'site.yaml', 'Konfigurationsdatei fehlt', {
      hint: 'site.yaml mit name, url, language, lifecycle, nav anlegen (docs/architecture.md)',
    });
  } else {
    try {
      raw = load(read('site.yaml'));
    } catch (e) {
      error('SITE_YAML_INVALID', 'R-05', 'site.yaml', `YAML nicht lesbar: ${e.message}`, {
        hint: 'Einrückung und Anführungszeichen prüfen',
      });
    }
  }
  if (raw !== undefined) {
    const parsed = parseSite(raw);
    if (parsed.ok) {
      site = parsed.data;
      lifecycle = site.lifecycle;
    } else {
      for (const issue of parsed.issues) {
        error('SITE_YAML_INVALID', 'R-05', `site.yaml${issue.path !== '(wurzel)' ? ` → ${issue.path}` : ''}`, issue.message, {
          path: issue.path,
          hint: 'Erlaubte Felder: name, tagline, url, language, lifecycle, nav, footer, contact (src/lib/site-schema.mjs)',
        });
      }
      // Für die übrigen Prüfungen wird der rohe Wert trotzdem benutzt: ein
      // Schemafehler soll nicht die anderen Befunde verdecken. Der Fehler bleibt
      // stehen und blockiert. Der Lebenszyklus kommt nur aus gültigen Daten.
      site = raw;
    }
  }
}

/* ============================== QUELLEN-CHECKS ============================ */

if (MODE === 'source') {
  // --- S1: site.yaml-Inhalte, die ein Schema nicht prüfen kann -------------
  if (site) {
    if (site.lifecycle !== 'production' && /^https:\/\/(example\.com|localhost|127\.0\.0\.1)/.test(site.url)) {
      warn('SITE_URL_PLACEHOLDER', 'R-05', 'site.yaml', `url ist eine Platzhalter-Domain: ${site.url}`, {
        hint: 'Vor dem Livegang auf die echte Domain setzen und lifecycle: production',
      });
    }
    // Duplikate gelten je Liste — ein Footer darf ein Nav-Ziel wiederholen.
    for (const list of ['nav', 'footer']) {
      const navTargets = new Set();
      for (const item of site[list] ?? []) {
        const key = canonical(item.href);
        if (key === null) continue; // ungültiges Ziel: melden die Schema- und Zielprüfungen
        if (navTargets.has(key)) {
          error('NAV_DUPLICATE', 'R-05', 'site.yaml', `${list} enthält ${key} mehrfach`, {
            target: key,
            hint: 'Ein Ziel gehört einmal in die Navigation — auch ohne abschließenden Slash',
          });
        }
        navTargets.add(key);
      }
    }
    const values = Object.entries(site.contact ?? {}).filter(([, v]) => v && isPlaceholder(String(v), ''));
    if (values.length && lifecycle === 'production') {
      error('CONTACT_PLACEHOLDER', 'R-05', 'site.yaml', `contact enthält Platzhalter: ${values.map(([k]) => k).join(', ')}`, {
        hint: 'Kontaktwerte ersetzen — Seiten mit contact: true rendern genau diese Werte',
      });
    }
  }

  // --- S2: Seiten, Dateinamen, Frontmatter, Routen -------------------------
  const byRoute = new Map();
  for (const page of pages) {
    const name = path.posix.basename(page.rel, '.md');
    if (!page.rel.endsWith('.md')) {
      error('PAGE_EXTENSION', 'R-06', page.rel, 'nur Markdown als Seite erlaubt');
    }
    if (!SEGMENT_RE.test(name)) {
      error('FILENAME', 'R-10', page.rel, `Dateiname verstößt gegen kebab-case: ${name}`, {
        hint: 'kleingeschrieben, a-z 0-9 und Bindestriche, keine Umlaute oder Leerzeichen',
      });
    }
    if (RESERVED_IDS.includes(name) && name !== 'start') {
      error('RESERVED_FILENAME', 'R-06', page.rel, `${name}.md ist reserviert — Startseite ist ausschließlich start.md`, {
        hint: 'umbenennen, Startseite kann nicht ersetzt werden',
      });
    }
    // Segmente unterhalb des Inhaltsverzeichnisses, ohne Dateiendung. Die Route
    // wird zusätzlich geprüft, weil ein slug eine andere Form haben kann als die
    // Datei.
    const badSegments = [...new Set([...invalidSegments(page.id.replace(/\.[^.]+$/, '')), ...(page.route ? invalidSegments(page.route) : [])])];
    if (badSegments.length) {
      error('PATH_SEGMENT', 'R-10', page.rel, `Pfadsegmente verstoßen gegen R-10: ${badSegments.join(', ')}`, {
        hint: 'jedes Verzeichnis kleingeschrieben und kebab-case',
      });
    }

    if (!page.data) {
      error(
        page.fmError ? 'FRONTMATTER_YAML' : 'FRONTMATTER_MISSING',
        'R-06',
        page.rel,
        page.fmError ? `Frontmatter-YAML fehlerhaft: ${page.fmError}` : 'Frontmatter fehlt',
        { hint: 'Vorlage: docs/seitenvorlage.md' },
      );
      continue;
    }
    const { title, description, slug, draft, noindex, contact, sources } = page.data;

    if (typeof title !== 'string' || title.trim().length < 2) {
      error('TITLE_MISSING', 'R-06', page.rel, 'title fehlt oder zu kurz', { hint: 'Schema: src/content.config.ts' });
    }
    if (typeof description !== 'string' || description.trim().length < 20) {
      error('DESCRIPTION_MISSING', 'R-06', page.rel, 'description fehlt oder zu kurz (20–200 Zeichen)');
    } else if (description.length > 200) {
      warn('DESCRIPTION_LONG', 'R-11', page.rel, `description ist ${description.length} Zeichen (Ziel: bis 200)`);
    }
    for (const [key, value] of [['draft', draft], ['noindex', noindex], ['contact', contact]]) {
      if (value !== undefined && typeof value !== 'boolean') {
        error('FRONTMATTER_TYPE', 'R-06', page.rel, `${key} muss true oder false sein`);
      }
    }

    if (slug !== undefined) {
      if (canonical(slug) !== slug) {
        error('SLUG_INVALID', 'R-10', page.rel, `slug ist nicht kanonisch: ${JSON.stringify(slug)}`, {
          hint: 'erlaubt ist / oder /pfad/ aus kleingeschriebenen kebab-case-Segmenten',
        });
      } else if (slug === '/' && !isHomeId(page.id)) {
        error('SLUG_RESERVED', 'R-06', page.rel, 'slug "/" ist die Startseite — dafür gibt es ausschließlich start.md', {
          hint: 'Startseite ist src/content/pages/start.md (R-06), andere Seiten brauchen einen eigenen Pfad',
        });
      }
    }

    if (Array.isArray(sources)) {
      for (const source of sources) {
        const clean = String(source).split('#')[0];
        if (!clean.startsWith('input/')) {
          error('SOURCE_PATH', 'R-07', page.rel, `Quelle liegt außerhalb von input/: ${source}`, {
            hint: 'Belege sind Dateien unter input/ (R-07)',
          });
        } else if (!existsSync(path.join(ROOT, clean))) {
          error('SOURCE_MISSING', 'R-07', page.rel, `belegte Quelle fehlt: ${clean}`, {
            hint: 'Datei in input/ ablegen oder Quellenangabe entfernen',
          });
        }
      }
    } else if (sources !== undefined) {
      error('SOURCE_PATH', 'R-07', page.rel, 'sources muss eine Liste von Pfaden sein');
    }

    for (const hit of unsafeMarkdownLines(page.text)) {
      error('UNSAFE_MARKDOWN', 'R-18', page.rel, `${hit.why} (Zeile ${hit.line})`, {
        line: hit.line,
        hint: 'Markdown ist Inhalt. Ausführbares oder Eingebettetes braucht eine ausdrückliche Freigabe (docs/security.md)',
      });
    }

    const route = routeForPage(page.id, slug);
    if (!route) {
      error('SLUG_INVALID', 'R-10', page.rel, `Route nicht bestimmbar (slug=${JSON.stringify(slug)})`);
    } else {
      if (byRoute.has(route)) {
        error('URL_COLLISION', 'R-10', page.rel, `URL-Kollision mit ${byRoute.get(route)}: beide ergeben ${route}`, {
          target: route,
        });
      }
      byRoute.set(route, page.rel);
      page.route = route;
    }
    page.draft = page.data.draft === true;

    const body = page.text.replace(/^---\r?\n[\s\S]*?\r?\n---/, '');
    if (/^#\s+\S/m.test(body)) {
      warn('H1_IN_CONTENT', 'R-06', page.rel, 'enthält eine h1 — die Überschrift liefert das Layout');
    }
  }

  if (!pages.some((p) => isHomeId(p.id))) {
    error('NO_START_PAGE', 'R-06', PAGES_DIR, 'keine Startseite — Startseite ist ausschließlich start.md', {
      hint: 'src/content/pages/start.md anlegen (Renderer und Validator verlangen dieselbe Datei)',
    });
  } else if (pages.some((p) => isHomeId(p.id) && p.draft)) {
    error('START_DRAFT', 'R-04', `${PAGES_DIR}/start.md`, 'Startseite ist als draft markiert', {
      hint: 'die Startseite kann nicht unveröffentlicht sein — draft entfernen oder Seite anders benennen',
    });
  }

  // --- S3: Navigation und interne Links ------------------------------------
  const published = new Map();
  const drafts = new Map();
  for (const p of pages.filter((p) => p.route)) {
    (p.draft ? drafts : published).set(canonical(p.route), p);
  }

  for (const list of ['nav', 'footer']) {
    for (const item of site?.[list] ?? []) {
      const target = canonical(item.href);
      if (published.has(target)) continue;
      if (drafts.has(target)) {
        error('NAV_TARGET_DRAFT', 'R-04', 'site.yaml', `${list} → ${target} zeigt auf eine Draft-Seite (${drafts.get(target).rel})`, {
          target,
          hint: 'Draft-Seiten sind nicht Teil der Veröffentlichung (R-04)',
        });
      } else {
        error('NAV_TARGET_MISSING', 'R-08', 'site.yaml', `${list} → ${target} gehört zu keiner Seite unter ${PAGES_DIR}`, {
          target,
          hint: 'Seite anlegen oder Eintrag entfernen',
        });
      }
    }
  }

  for (const page of pages) {
    if (!page.data) continue;
    for (const link of page.links) {
      const { path: target, fragment } = splitTarget(link.target);
      const at = { line: link.line, target: link.target };
      if (link.image && !link.alt.trim()) {
        error('EMPTY_ALT', 'R-11', page.rel, `Bild ohne Alt-Text (Zeile ${link.line})`, {
          ...at,
          hint: 'beschreiben oder alt="" für bewusst dekorative Bilder',
        });
      }
      if (/^(https?:|mailto:|tel:|data:)/i.test(link.target)) {
        if (/^http:\/\//i.test(link.target)) {
          gate('LINK_INSECURE', 'R-11', page.rel, `unsichere http-Adresse (Zeile ${link.line}): ${link.target}`, at);
        }
        if (/localhost|127\.0\.0\.1/.test(link.target)) {
          error('LINK_LOCALHOST', 'R-04', page.rel, `lokale Adresse in Zeile ${link.line}: ${link.target}`, {
            ...at,
            hint: 'veröffentlichte Seiten verweisen nicht auf eine Entwicklungsmaschine',
          });
        }
        if (link.image && /^https?:/i.test(link.target)) {
          warn('IMAGE_REMOTE', 'R-18', page.rel, `Bild von externem Server in Zeile ${link.line}: ${link.target}`, {
            ...at,
            hint: 'Assets nach public/assets/ übernehmen — externe Einbettung ist eine Freigabeentscheidung',
          });
        }
        continue;
      }
      if (target === '' || target.startsWith('#')) continue; // reines Fragment: Sprungmarke in derselben Seite
      if (!target.startsWith('/')) {
        warn('LINK_RELATIVE', 'R-10', page.rel, `relativer Link in Zeile ${link.line}: ${link.target}`, {
          ...at,
          hint: 'intern immer absolut ab / schreiben — relative Wege brechen beim Umziehen von Dateien',
        });
        continue;
      }
      // Segmentprüfung: bei Seiten der ganze Pfad, bei Assets nur die
      // Verzeichnisse — ein Dateiname darf einen Punkt enthalten (bild.svg).
      const badLinkSegments = invalidSegments(isPagePath(target) ? target : path.posix.dirname(target));
      if (badLinkSegments.length) {
        error('PATH_SEGMENT', 'R-10', page.rel, `Link-Ziel verstößt gegen R-10 (Zeile ${link.line}): ${target}`, at);
      }
      if (link.image || !isPagePath(target)) {
        if (!existsSync(path.join(ROOT, publicPath(target)))) {
          error('ASSET_MISSING', 'R-08', page.rel, `Asset fehlt in Zeile ${link.line}: ${link.target}`, {
            ...at,
            hint: 'Datei unter public/ ablegen oder Link entfernen',
          });
        }
        continue;
      }
      const route = canonical(target);
      if (published.has(route)) continue;
      if (drafts.has(route)) {
        error('LINK_DRAFT_TARGET', 'R-04', page.rel, `Link in Zeile ${link.line} auf Draft-Seite ${drafts.get(route).rel}`, at);
      } else {
        error('DEAD_INTERNAL_LINK', 'R-08', page.rel, `toter interner Link in Zeile ${link.line}: ${route}`, {
          ...at,
          hint: 'Seite anlegen, Link entfernen oder Ziel korrigieren — Query und Fragment sind nicht die Ursache',
        });
      }
      if (fragment) {
        // Sprungmarken auf anderen Seiten werden im Build geprüft (dist), wo
        // die tatsächlich erzeugten ids vorliegen.
        note('ANCHOR_DEFERRED', 'R-08', page.rel, `Sprungmarke ${fragment} in Zeile ${link.line} wird im Build geprüft`, at);
      }
    }
    if (page.draft) note('DRAFT', 'R-04', page.rel, 'Draft — erscheint nicht im Build');
  }

  // --- S4: Vertrauensgrenze input/ -----------------------------------------
  for (const forbidden of ['public/input', 'src/input', 'public/raw', 'src/assets/input']) {
    if (existsSync(path.join(ROOT, forbidden))) {
      error('INPUT_IN_PUBLIC', 'R-04', forbidden, 'Material aus input/ liegt im Auslieferungsbereich', {
        hint: 'veröffentlicht wird nur, was freigegeben wurde — input/ bleibt Grenze (docs/security.md)',
      });
    }
  }
  for (const rel of [...walk('public'), ...walk('src')]) {
    const hit = inputIndex.get(shaOf(rel));
    // Der Index vergleicht vollständige Dateien. Das ist ein Ubernahme-Hinweis,
    // keine Datenlecksuche: eine geänderte Zeile genügt, um nicht gefunden zu werden.
    if (hit) warn('INPUT_IDENTICAL_FILE', 'R-04', rel, `byte-identisch mit ${hit} — Übernahme im Commit-Message belegen`, { hint: 'R-07: Beleg angeben; der Check erkennt nur vollständig identische Dateien' });
  }

  const SECRET = new RegExp(`${'-'.repeat(5)}BEGIN [A-Z ]*PRIVATE KEY${'-'.repeat(5)}|(?:AKIA|glpat-|sk-)[A-Za-z0-9_-]{16,}`);
  const KEY_FILE = /(\.pem|\.key|\.p12|\.pfx|id_rsa|id_ed25519|^\.env)/i;
  const BINARY = /\.(png|jpe?g|gif|webp|avif|ico|pdf|zip|gz|tar|bz2|7z|mp3|mp4|mov|woff2?|ttf|otf|eot|wasm|so|dylib|node)$/i;
  for (const rel of walk('.')) {
    const base = path.posix.basename(rel);
    if (KEY_FILE.test(base) || KEY_FILE.test(rel)) {
      error('SECRET_FILE', 'R-04', rel, 'Schlüssel- oder Umgebungsdatei im Repository', {
        hint: 'aus dem Repo entfernen und Rotieren — .gitignore allein genügt nicht, wenn die Datei bereits committet wurde',
      });
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
    if (text.includes('\0')) continue;
    const line = text.split('\n').findIndex((l) => SECRET.test(l));
    if (line >= 0) {
      error('SECRET_CONTENT', 'R-04', rel, `sieht nach einem Geheimnis aus (Zeile ${line + 1})`, {
        line: line + 1,
        hint: 'Rotieren und entfernen. Ein Repository ist kein Geheimnisspeicher (docs/security.md)',
      });
    }
  }

  // Material in input/ ist standardmäßig nicht getrackt. Werden Dateien daraus
  // committet, ist das eine Entscheidung über die zweite Publikationsgrenze:
  // das Repository selbst, nicht die Website.
  const trackedInput = (git('ls-files', 'input/') ?? '')
    .split('\n')
    .filter((f) => f && !/(^|\/)(README\.md|brief\.example\.md)$/.test(f));
  if (trackedInput.length) {
    // Eine Diagnose pro Datei: die Entscheidung über die zweite Publikations-
    // grenze wird je Materialstück getroffen, nicht für den Ordner pauschal.
    for (const rel of trackedInput.slice(0, 20)) {
      gate('INPUT_TRACKED', 'R-04', rel, 'Material aus input/ ist im Repository getrackt', {
        hint: 'Bei einem öffentlichen Repository ist diese Datei öffentlich. Entweder nicht committen (privat by default) oder bewusst freigeben — dann Repo-Sichtbarkeit und lifecycle prüfen (docs/security.md)',
      });
    }
    if (trackedInput.length > 20) {
      gate('INPUT_TRACKED', 'R-04', 'input/', `${trackedInput.length - 20} weitere getrackte Materialdateien`, { hint: 'wie oben' });
    }
  }

  // --- S5: Build-Hygiene ---------------------------------------------------
  const gitignore = existsSync(path.join(ROOT, '.gitignore')) ? read('.gitignore') : '';
  for (const required of ['dist/', '.astro/', 'node_modules/', '.DS_Store']) {
    if (!gitignore.includes(required)) {
      error('GITIGNORE_MISSING', 'R-03', '.gitignore', `${required} fehlt — generierte Dateien werden nicht committet`);
    }
  }
  if (!/^input\/\*\*$/m.test(gitignore)) {
    error('GITIGNORE_MISSING', 'R-04', '.gitignore', 'input/ ist nicht standardmäßig ignoriert', {
      hint: 'input/** ignorieren, Ausnahmen für README.md und brief.example.md sind in docs/security.md beschrieben',
    });
  }
  const trackedGenerated = (git('ls-files', 'dist', '.astro') ?? '').trim();
  if (trackedGenerated) {
    error('GENERATED_TRACKED', 'R-03', 'git', `generierte Dateien sind committet: ${trackedGenerated.split('\n').slice(0, 3).join(', ')}`);
  }

  // --- S6: Control Plane (R-19) -------------------------------------------
  const CONTROL_PLANE = [/^AGENTS\.md$/, /^CLAUDE\.md$/, /^scripts\//, /^tests\//, /^\.github\//, /^package(-lock)?\.json$/, /^src\/content\.config\.ts$/, /^astro\.config\.mjs$/, /^src\/lib\/(route|site-schema)\.mjs$/, /^\.node-version$/];
  const changed = [
    ...(git('diff', '--name-only', 'HEAD') ?? '').split('\n'),
    ...(git('ls-files', '--others', '--exclude-standard') ?? '').split('\n'),
    // In CI sind Änderungen committet. CHECK_BASE_REF (z. B. origin/main) vergleicht
    // zusätzlich gegen die Basis — dieselbe Liste, keine zweite Implementierung.
    ...baseRefFiles(),
  ].filter(Boolean);
  const touched = [...new Set(changed.filter((f) => CONTROL_PLANE.some((re) => re.test(f))))];
  if (touched.length) {
    warn('CONTROL_PLANE_CHANGED', 'R-19', 'control plane', `${touched.length} Datei(en) der Control Plane geändert: ${touched.slice(0, 5).join(', ')}`, {
      hint: 'Validator, Regeln, Schema und CI sind der Schutz des Systems — Änderung braucht ein eigenes Vorhaben und menschliche Prüfung (docs/security.md)',
    });
  }

  // --- S7: Erreichbarkeit --------------------------------------------------
  const linkedTargets = new Set();
  for (const page of pages) {
    if (page.draft) continue;
    for (const link of page.links) {
      if (link.target.startsWith('/') && isPagePath(link.target)) linkedTargets.add(canonical(link.target));
    }
  }
  const navTargets = new Set([...(site?.nav ?? []), ...(site?.footer ?? [])].map((i) => canonical(i.href)));
  for (const page of pages) {
    if (page.draft || !page.route) continue;
    const target = canonical(page.route);
    if (target === '/' || navTargets.has(target) || linkedTargets.has(target)) continue;
    warn('UNREACHABLE', 'R-08', page.rel, `von keiner Navigation und keiner anderen Seite verlinkt: ${page.route}`, {
      hint: 'in die Navigation aufnehmen, verlinken oder entfernen — eine Seite ohne Zugang ist kein Inhalt',
    });
  }
  if (site && !pages.some((p) => /impressum/i.test(p.route ?? ''))) {
    warn('NO_LEGAL_PAGE', 'R-13', PAGES_DIR, 'keine Impressums-Seite — rechtliche Pflichtangaben brauchen eine eigene Seite');
  }

  // --- S8: Platzhalter -----------------------------------------------------
  const found = new Map();
  for (const rel of [...walk('src'), 'site.yaml']) {
    if (!/\.(md|ya?ml|astro|css|ts)$/.test(rel)) continue;
    if (!existsSync(path.join(ROOT, rel))) continue; // fehlende site.yaml meldet S1
    const lines = placeholderLines(rel);
    if (lines.length) found.set(rel, lines);
  }
  for (const [rel, lines] of [...found].sort()) {
    gate('PLACEHOLDER', 'R-07', rel, `${lines.length} Platzhalter in Zeile${lines.length > 1 ? 'n' : ''} ${lines.join(', ')}`, {
      lines,
      hint: 'durch belegte Inhalte ersetzen (R-07) — im lifecycle: production blockiert das den Release',
    });
  }
  if (found.size === 0) note('NO_PLACEHOLDERS', 'R-07', '—', 'keine Platzhalter im Quellenzustand');
}

/* ============================== BUILD-CHECKS ============================== */

if (MODE === 'dist') {
  const FORBIDDEN = [
    { re: /(^|\/)\.DS_Store$/, why: 'macOS-Metadaten' },
    { re: /(^|\/)Thumbs\.db$/, why: 'Windows-Metadaten' },
    { re: /(^|\/)README\.md$/, why: 'interne Dokumentation' },
    { re: /\.map$/, why: 'Quellkarten' },
    { re: /(^|\/)\.env/, why: 'Umgebungsdatei' },
    { re: /\.(pem|key|p12|pfx)$/i, why: 'Schlüsselmaterial' },
    { re: /(^|\/)(\.git|\.astro|node_modules|src|input|site\.yaml)(\/|$)/, why: 'kein Bestandteil der Auslieferung' },
  ];

  if (!existsSync(path.join(ROOT, 'dist'))) {
    error('DIST_MISSING', 'R-03', 'dist', 'Build-Ausgabe fehlt', { hint: 'zuerst npm run build' });
  } else {
    const files = walk('dist');
    const html = files.filter((f) => f.endsWith('.html'));

    for (const rel of files) {
      const hit = FORBIDDEN.find((f) => f.re.test(rel));
      if (hit) error('FORBIDDEN_DIST_FILE', 'R-03', rel, `gehört nicht in die Auslieferung (${hit.why})`, { hint: 'Datei aus public/ entfernen — public/ wird unverändert übernommen' });
      if (readFileSync(path.join(ROOT, rel)).length === 0) error('EMPTY_FILE', 'R-12', rel, 'leere Datei im Build');
      const source = inputIndex.get(shaOf(rel));
      if (source) {
        error('INPUT_IN_DIST', 'R-04', rel, `Inhalt ist byte-identisch mit ${source}`, {
          hint: 'Material aus input/ wird nicht unverändert veröffentlicht (R-04)',
        });
      }
    }

    // D1: jede veröffentlichte Seite liegt vor, keine Draft-Seite
    for (const page of pages) {
      const data = page.data ?? {};
      const route = routeForPage(page.id, data.slug);
      if (!route) continue;
      const expected = `dist/${outputFileFor(route)}`;
      if (data.draft === true) {
        if (existsSync(path.join(ROOT, expected))) {
          error('DRAFT_PUBLISHED', 'R-04', page.rel, `Draft-Seite wurde veröffentlicht (${expected})`, {
            hint: 'Vertrauensgrenze verletzt — Drafts erscheinen nicht im Build (R-04)',
          });
        }
      } else if (!existsSync(path.join(ROOT, expected))) {
        error('PAGE_MISSING_IN_BUILD', 'R-12', page.rel, `Seite fehlt im Build: erwartet wurde ${expected}`, {
          hint: 'Route und Startseite prüfen: Startseite ist ausschließlich start.md (R-06)',
        });
      }
    }

    // D2: tote Ziele im fertigen HTML — Pfad und Sprungmarke
    const byFileHtml = new Map(html.map((rel) => [rel, read(rel)]));
    const resolveTarget = (fromRel, target) => {
      const { path: clean, fragment } = splitTarget(target);
      if (/^(https?:|mailto:|tel:|data:|\/\/|#)/i.test(target) || clean === '') return null;
      const dir = path.posix.dirname(fromRel);
      const resolved = clean.startsWith('/')
        ? path.posix.normalize(`dist/${clean}`)
        : path.posix.normalize(`${dir}/${clean}`);
      const asFile = existsSync(path.join(ROOT, resolved));
      const asDirIndex = existsSync(path.join(ROOT, `${resolved.replace(/\/$/, '')}/index.html`));
      return { resolved, fragment, exists: asFile || asDirIndex };
    };

    for (const [rel, text] of byFileHtml) {
      const re = /(?:href|src|action)=["']([^"']+)["']/gi;
      let m;
      while ((m = re.exec(text))) {
        const target = m[1];
        const resolvedTarget = resolveTarget(rel, target);
        if (!resolvedTarget) continue;
        if (!resolvedTarget.exists) {
          error('DEAD_TARGET', 'R-08', rel, `totes Ziel: ${target}`, { target, hint: 'Link korrigieren oder Datei ausliefern' });
          continue;
        }
        if (resolvedTarget.fragment) {
          const targetRel = resolvedTarget.resolved.endsWith('/')
            ? `${resolvedTarget.resolved.replace(/\/$/, '')}/index.html`
            : resolvedTarget.resolved;
          const targetHtml = byFileHtml.get(targetRel) ?? (existsSync(path.join(ROOT, targetRel)) ? read(targetRel) : '');
          const id = resolvedTarget.fragment;
          if (targetHtml && !new RegExp(`id=["']${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`, 'i').test(targetHtml)) {
            error('DEAD_ANCHOR', 'R-08', rel, `Sprungmarke ${id} existiert nicht in ${targetRel}`, {
              target,
              hint: 'Ziel-id setzen oder Sprungmarke entfernen',
            });
          }
        }
      }
    }

    // D3: Grundausstattung jeder Seite
    for (const [rel, text] of byFileHtml) {
      if (!/<title>[^<]{2,}<\/title>/i.test(text)) error('NO_TITLE', 'R-11', rel, 'kein <title>');
      const langMatch = /<html[^>]*\slang="([^"]*)"/i.exec(text);
      if (!langMatch) error('NO_LANG', 'R-11', rel, '<html> ohne lang', { hint: 'kommt aus site.yaml language (R-05)' });
      else if (!/^[a-z]{2}(-[A-Z]{2})?$/.test(langMatch[1])) {
        error('NO_LANG', 'R-11', rel, `lang="${langMatch[1]}" ist keine gültige Sprachangabe`, { hint: 'site.yaml language (R-05), z. B. de oder de-DE' });
      }
      const h1 = (text.match(/<h1[\s>]/gi) ?? []).length;
      if (h1 !== 1) error('H1_COUNT', 'R-11', rel, `${h1} <h1> — genau eines, und es kommt aus dem Layout`);
      if (!/name=["']description["']/i.test(text)) warn('NO_DESCRIPTION', 'R-11', rel, 'keine Meta-Beschreibung');
      if (!/rel=["']canonical["']/i.test(text)) warn('NO_CANONICAL', 'R-10', rel, 'kein kanonischer Link');

      // Indexierungszustand (R-21)
      const robotsMeta = /<meta name="robots" content="([^"]*)"/i.exec(text)?.[1] ?? '';
      if (lifecycle === 'development' && !/noindex/i.test(robotsMeta)) {
        error('INDEXABLE_IN_DEVELOPMENT', 'R-21', rel, 'Seite ist im development-Zustand indexierbar', {
          hint: 'lifecycle: development setzt noindex; prüfen, ob die Seite das Layout benutzt',
        });
      }
    }

    // D4: robots.txt und Sitemap
    const robotsPath = 'dist/robots.txt';
    if (existsSync(path.join(ROOT, robotsPath))) {
      const robots = read(robotsPath);
      // Die Sitemap-Zeile gehört zur Auslieferungsadresse und gilt in beiden
      // Zuständen — eine Sitemap auf einer anderen Domain ist immer falsch.
      const sm = /Sitemap:\s*(\S+)/i.exec(robots)?.[1];
      if (site && sm && !sm.startsWith(site.url)) {
        error('ROBOTS_ORIGIN', 'R-05', robotsPath, `Sitemap-URL passt nicht zu site.yaml url=${site.url}: ${sm}`);
      }
      if (lifecycle === 'development' && !/Disallow:\s*\/\s*$/m.test(robots)) {
        error('ROBOTS_LIFECYCLE_MISMATCH', 'R-21', robotsPath, 'robots.txt erlaubt Indexierung im development-Zustand', {
          hint: 'robots.txt wird aus lifecycle erzeugt (src/pages/robots.txt.ts) — eine statische Datei in public/ überschreibt sie',
        });
      }
      if (lifecycle === 'production') {
        if (!/Allow:\s*\//m.test(robots)) error('ROBOTS_LIFECYCLE_MISMATCH', 'R-21', robotsPath, 'production ohne Allow: /');
        if (!sm) warn('NO_SITEMAP_LINK', 'R-21', robotsPath, 'robots.txt nennt keine Sitemap');
      }
    } else {
      error('NO_ROBOTS', 'R-21', 'dist/robots.txt', 'fehlt', { hint: 'Route src/pages/robots.txt.ts liefert sie aus dem lifecycle' });
    }

    if (existsSync(path.join(ROOT, 'dist/sitemap.xml'))) {
      const xml = read('dist/sitemap.xml');
      if (!xml.includes('<urlset')) error('SITEMAP_INVALID', 'R-12', 'dist/sitemap.xml', 'kein gültiges urlset');
      const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
      if (site) {
        const foreign = locs.filter((loc) => !loc.startsWith(site.url));
        if (foreign.length) error('SITEMAP_ORIGIN', 'R-05', 'dist/sitemap.xml', `Einträge außerhalb von url=${site.url}: ${foreign.slice(0, 3).join(', ')}`);
      }
      const expected = pages.filter((p) => p.data && p.data.draft !== true && p.data.noindex !== true).length;
      if (locs.length !== expected) warn('SITEMAP_COUNT', 'R-12', 'dist/sitemap.xml', `${locs.length} Einträge, erwartet ${expected} veröffentlichte Seiten`);
      if (lifecycle === 'development') {
        note('SITEMAP_DEVELOPMENT', 'R-21', 'dist/sitemap.xml', 'Sitemap vorhanden, aber robots.txt sperrt die Indexierung');
      }
    } else {
      warn('NO_SITEMAP', 'R-12', 'dist/sitemap.xml', 'fehlt');
    }

    // D5: Platzhalter im ausgelieferten HTML
    let hits = 0;
    for (const rel of html) {
      const lines = placeholderLines(rel);
      if (lines.length) {
        hits += lines.length;
        gate('PLACEHOLDER', 'R-07', rel, `${lines.length} Platzhalter im ausgelieferten HTML (Zeilen ${lines.slice(0, 6).join(', ')})`, {
          lines,
          hint: 'vor dem Livegang ersetzen (R-07)',
        });
      }
    }
    if (hits === 0) note('CLEAN_OUTPUT', 'R-07', '—', `${html.length} Seiten ohne Platzhalter gebaut`);
  }
}

/* ================================ Ausgabe ================================= */

const bySeverity = (s) => diagnostics.filter((d) => d.severity === s);
const errors = bySeverity('error');
const warnings = bySeverity('warning');
const notes = bySeverity('note');

const format = (d) => {
  const where = d.line ? `${d.file}:${d.line}` : d.file;
  const mark = d.severity === 'error' ? '✗' : d.severity === 'warning' ? '!' : '·';
  return `  ${mark} ${d.code.padEnd(28)} ${where} — ${d.message}  [${d.rule}]`;
};

// Release-Gate (R-21): ein Release ist eine ausdrückliche Entscheidung.
let releaseProblems = [];
if (RELEASE) {
  if (lifecycle !== 'production') {
    releaseProblems.push({
      severity: 'error',
      code: 'LIFECYCLE_NOT_PRODUCTION',
      rule: 'R-21',
      file: 'site.yaml',
      message: `lifecycle ist "${lifecycle}" — ein Release verlangt lifecycle: production`,
      hint: 'Erst prüfen: echte Domain, keine Platzhalter, rechtliche Seiten, Freigabe durch den Menschen (npm run check:release)',
    });
  }
}

const all = [...releaseProblems, ...diagnostics];
const allErrors = [...errors, ...releaseProblems];
const STRICT_EFFECTIVE = STRICT || RELEASE;
const blocked = allErrors.length > 0 || (STRICT_EFFECTIVE && all.filter((d) => d.severity === 'warning').length > 0);

if (JSON_OUT) {
  process.stdout.write(
    `${JSON.stringify(
      {
        ok: !blocked,
        mode: MODE,
        lifecycle,
        strict: STRICT_EFFECTIVE,
        release: RELEASE,
        summary: {
          errors: allErrors.length,
          warnings: all.filter((d) => d.severity === 'warning').length,
          notes: notes.length,
        },
        diagnostics: all,
      },
      null,
      2,
    )}\n`,
  );
} else {
  console.log(`check ${MODE} — lifecycle: ${lifecycle}${RELEASE ? ' — RELEASE-GATE' : ''}${STRICT ? ' — strict' : ''}`);
  if (allErrors.length) console.log(`\nFEHLER (${allErrors.length}):\n${[...releaseProblems, ...errors].sort().map(format).join('\n')}`);
  if (warnings.length) console.log(`\nWARNUNGEN (${warnings.length}):\n${warnings.sort().map(format).join('\n')}`);
  if (notes.length) console.log(`\nNOTIZEN (${notes.length}):\n${notes.sort().map(format).join('\n')}`);
  console.log(
    blocked
      ? `\nErgebnis: BLOCKIERT — ${allErrors.length} Fehler, ${warnings.length} Warnungen.`
      : `\nErgebnis: OK — ${errors.length} Fehler, ${warnings.length} Warnungen.`,
  );
}

process.exit(blocked ? 1 : 0);
