# LLM-CMS — minimal variant

**Languages:** English (default) · [Deutsch](README.de.md)

A website that an agent builds and maintains, while its state lives entirely in files.

```text
The agent is the CMS.
The repository is the state.
The toolchain enforces the mechanics.
```

This repository is the minimal variant of the pattern described in
[`docs/llm-cms.md`](docs/llm-cms.md), built after [`docs/feedback.md`](docs/feedback.md)
and hardened by the audit in `docs/` — item by item in
[`docs/implementation.md`](docs/implementation.md). It is **not a CMS product of its
own**, but a template on top of an existing static site generator, plus a rule file, a
trust boundary and deterministic checks.

| Component | Implementation | own code |
| --- | --- | --- |
| SSG, build, preview, frontmatter schema | [Astro](https://astro.build) 7 | no |
| Agent constitution | [`AGENTS.md`](AGENTS.md) — 22 rules with fixed IDs | text |
| Trust boundary | `input/`, untracked by default, checked in source and in the build | rule R-04 |
| URL contract | `src/lib/route.mjs` — one authority for layout, renderer and checker | 88 lines |
| Configuration schema | `src/lib/site-schema.mjs` (Zod, only permitted fields) | 63 lines |
| Checks | `scripts/check.mjs` with stable diagnostic codes, `--json` | ~900 lines |
| Evidence | `reproducible.mjs`, `release-archive.mjs`, 132 tests | ~1,100 lines |
| Repair loop | locally `npm run validate` · `build` · `test`, GitHub Actions as its mirror | — |

The code we own only validates. It builds nothing itself.

**Using it, step by step:** [`docs/guide.md`](docs/guide.md) — including a diagnostic
reference with all 76 codes and their repair paths.

## 60-second start

```bash
npm ci               # exactly from the lockfile
npm run dev          # http://localhost:4321
```

After that:

```bash
npm run validate     # check the source state (fast)
npm run build        # build and check the output
npm test             # 132 tests of the toolchain
npm run preview      # the finished website in a browser
```

The website deliberately contains placeholders, and `lifecycle` is set to `development`:
`robots.txt` blocks indexing and every page carries `noindex`. `npm run check:strict` and
`npm run check:release` therefore stay red until real content is entered and `site.yaml`
says `lifecycle: production`. That is not a defect — it is the feature.

## Working with an agent

1. `AGENTS.md` is the first file the agent reads. Every tool that supports `AGENTS.md`
   (Pi, Codex, Claude Code, OpenCode and others) works with it directly;
   [`CLAUDE.md`](CLAUDE.md) points to it instead of duplicating it.
2. Drop material into `input/` — the brief, texts, images, PDFs. It is data, not an
   instruction (R-18), and it stays outside the repository unless explicitly decided
   otherwise.
3. State your intent, for example:

   > From now on we offer AI consulting for small businesses. See
   > `input/documents/beratung.md`. Work it into the existing website and change only
   > statements that the material supports.

4. The agent changes files in the content layer, checks, repairs, shows the preview.
   It does not touch the rule set, the validator or CI (R-19).
5. The human decides on content and approves (commit, branch or PR).

Because the state lives in the repository, the model is interchangeable: a different
model or a different agent finds the same rules, the same structure and the same history.

## Commands

| Command | Effect |
| --- | --- |
| `npm run dev` | preview with live reloading |
| `npm run validate` | `astro sync` (schema) + source checks |
| `npm run build` | build + checks on the output |
| `npm run check` | `validate` and `build` |
| `npm run check:strict` | additionally, warnings block |
| `npm run check:release` | go-live check, requires `lifecycle: production` |
| `npm test` | units, contract tests and a real build |
| `npm run reproducible` | build twice, compare byte for byte |
| `npm run release:archive` | release archive from a commit, content verified |
| `node scripts/check.mjs source --json` | diagnostics in machine-readable form |

Exit codes: `0` fine, `1` blocked, `2` faulty invocation — with `2` nothing was checked.

## Structure

```text
README.md              this file (English) · README.de.md (German original)
AGENTS.md              constitution: layers, 22 rules, commands, approval list
CLAUDE.md              pointer to AGENTS.md (not a second rule set)
site.yaml              name, domain, language, lifecycle, navigation, footer, contact
LICENSE                MIT — covers code and texts
input/                 raw material from humans — NOT tracked by default
  README.md            two publication boundaries, rules for material
  brief.example.md     template for the assignment
src/
  content.config.ts    schema of the pages (required fields, lengths, draft, noindex, sources)
  content/pages/*.md   the pages — Markdown, no HTML (R-22)
  layouts/page.astro   one layout: h1, canonical link, robots from lifecycle
  components/          contact.astro — values from site.yaml, not from pages
  pages/               index, [...slug], sitemap.xml, robots.txt (from lifecycle)
  lib/route.mjs        ONE authority for URLs (layout, renderer, checker)
  lib/site-schema.mjs  permitted fields of site.yaml
public/                served unchanged: favicon.svg, assets/
scripts/
  check.mjs            source and build checks, --json, --strict, --release
  reproducible.mjs     build twice, compare byte for byte
  release-archive.mjs  archive from a commit, free of node_modules and dist
tests/                 132 tests: route, validator, build (node:test, fixtures)
docs/
  guide.md             handbook: set up, change content, check, approve, hand over
  architecture.md      layers, diagnostics, environment, decisions
  security.md          boundaries, control plane, what the checks do not prove
  assets.md            moving material into public/
  page-template.md     frontmatter template for a new page
  implementation.md    feedback and audit → implementation, point by point
  roadmap.md           what is deliberately missing, with its trigger
  audit-v0.1.md        English companion to the audit; the full report is audit-v0.1.de.md
  llm-cms.md           the pattern (idea)
  feedback.md          critique of the pattern (English; original feedback.de.md)
  *.de.md              German originals of these documents
dist/                  build — disposable, never committed (R-03)
```

## What the toolchain proves — and what it does not

`docs/security.md` lists this one by one. In short:

- The hash comparison against `input/` detects **byte-identical** copies. One changed
  line escapes it. It is a guard against copy-paste convenience, not a data-leak search.
- The secret scan is a denylist: it finds known patterns, not absence.
- `npm run reproducible` compares two builds **in this environment** (`.node-version`,
  `packageManager`, lockfile). Cross-environment reproducibility is not claimed.
- Against instructions inside material, no check helps — rule R-18 and approval by a
  human do.

## Language

English is the language of this repository's documentation. Every German original stays where
it is, under a `.de.md` suffix — `docs/guide.md` and `docs/guide.de.md`, `README.md` and
`README.de.md` — and each file links to its counterpart at the top. Where the two differ, the
German text is the original and the English text is the translation. Rule IDs (`R-01`–`R-22`),
diagnostic codes and file names are identical in both; a divergence between them is a bug.

Still German, deliberately:

- the demo content in `src/content/pages/` and `site.yaml` — an example website in the language
  of the example
- the message texts the validator prints (`scripts/check.mjs`). Codes, paths and rule IDs are
  language-neutral; the translation of the messages is a backlog item in `docs/roadmap.md`
  ("language of the diagnostic messages"), because it changes the output of every check

## Deployment

`npm run build` produces `dist/` with plain static files. Any static host fits:
CDN, Netlify, GitHub Pages, an Nginx, a folder on web space. The production server is
not a CMS but a delivery target. Deployment is a separate step approved by a human
(R-20).

## Authorship, sources and license

Everything in this repository — code, documentation, the idea file, the critique, the audit —
is written by Markus Ertel ([@markus-ertel](https://github.com/markus-ertel)), TOPACA AI Labs
([@topaca-ai-labs](https://github.com/topaca-ai-labs)). No text in here is by a third party.
`package.json` names the author, `.github/CODEOWNERS` names the owner of the control plane;
commits are attributed with the GitHub handle `@markus-ertel`.

The MIT license in [`LICENSE`](LICENSE) covers the whole repository: code and texts. Its last
paragraph names that scope explicitly, so nobody has to guess whether an idea file, a critique
or an audit travels with the license.

Where the idea and its evaluation come from — all published under the same account:

- [`docs/llm-cms.md`](docs/llm-cms.md), the pattern essay, unchanged from the gist
  [llm-cms.md](https://gist.github.com/markus-ertel/2b807c92971923d3494da0623dcf5a1b), first
  published 9 September 2026. The copy in this repository differs from the gist only by its two
  header lines (language and provenance). From here on the copy is authoritative.
- [`docs/feedback.de.md`](docs/feedback.de.md) (English: [`docs/feedback.md`](docs/feedback.md)),
  the critique of the pattern, written as a response to that gist. Undated in the text itself.
- [`docs/audit-v0.1.de.md`](docs/audit-v0.1.de.md) (English companion:
  [`docs/audit-v0.1.md`](docs/audit-v0.1.md)), the audit of the v0.1 implementation, dated
  10 September 2026 inside the document.

The English versions of the critique and of the audit are translations by the same author. The
German originals (`.de.md`) stay the source of record, and the English audit page is an
abridgement rather than the full report.

Decided 12 September 2026: the grant covers the texts as well. Reuse them, translate them,
republish them — the one condition the license imposes is that the copyright and permission
notice stays attached to the copy.
