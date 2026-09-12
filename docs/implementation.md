# Feedback and audit → implementation

**Languages:** English (default) · [Deutsch](umsetzung.de.md)

Two sources, one comparison: [`docs/feedback.md`](feedback.md) (criticism of the pattern) and
[`docs/audit-v0.1.md`](audit-v0.1.md) (criticism of v0.1). Every row is verifiable by a file,
a command or a named test. Nothing here is a statement of intent.

## 1. From the feedback

| Recommendation | Implementation | Verify with |
| --- | --- | --- |
| "choose an SSG: Astro or Hugo gives you build, preview, frontmatter validation and reproducible output for free" | Astro 7, no compiler layer of our own, frontmatter as a required-field schema | `npm run build`, `src/content.config.ts` |
| "put `AGENTS.md` in the repo: structure, rules, no-go claims, validation commands" | `AGENTS.md` with 22 rules of fixed ID, layers, commands, check catalog, release list | `AGENTS.md` §1–§8 |
| "`input/` convention: nothing unverified into `content/`" | `input/` with README, trust boundary R-04, checks `INPUT_IN_PUBLIC`, `INPUT_IN_DIST`, `INPUT_IDENTICAL_FILE`, `INPUT_TRACKED` | `tests/validator.test.mjs` → *trust boundary* |
| "deterministic checks plus CI as a repair loop" | `npm run validate`, `npm run build`, `npm test`; CI runs the same commands | `.github/workflows/validate.yml` |
| "attach any agent, switching the model works" | R-02, R-16: state only in files, no session knowledge, no model assumption in the build | `AGENTS.md` R-02, R-16 |
| "three-layer model: `.gitignore` plus convention is enough" | layers in `AGENTS.md` §1, `.gitignore` for `dist/`, `.astro/`, `input/**`; only the boundary is checked | `docs/architecture.md` §2 |
| "a CMS product of your own reproduces Astro — a starter template makes sense instead" | no `init`, no build of our own, no admin UI. Three scripts that check | `scripts/`, `AGENTS.md` R-17 |
| "machine-web dual output later, `llms.txt` is not supported" | no second output format; machine readability through semantic HTML, `lang`, canonical link, sitemap, `robots.txt` | `docs/roadmap.md` |
| "own development effort at about ten percent" | 3 own scripts, 1 schema, 1 route module; the rest is Astro and text | `package.json`, `docs/architecture.md` §1 |

## 2. From the audit: P0 (before reference approval)

| Finding | Implementation | Evidence |
| --- | --- | --- |
| P0-01 fix or replace `selftest.sh` | deleted without replacement. New harness: `node:test` with fixture copies in temporary directories, no bash/`sed`/`rsync` | `tests/helpers.mjs`, `npm test` |
| P0-02 tests must check expected error codes | `assertBlocked(res, [{ code, file, line, severity }])`; a test fails if the expected code is missing or occurs somewhere else | `tests/helpers.mjs`, 74 validator tests |
| P0-03 unknown validator modes fail-closed | unknown mode → exit `2` with `UNKNOWN_MODE`; nothing is checked | `tests/validator.test.mjs` → *invocation* |
| P0-04 decide the license | MIT, `LICENSE`, `package.json "license"` | `LICENSE`, `npm run release:archive` (missing license in the commit → abort) |
| P0-05 clean up the release package | `scripts/release-archive.mjs` builds the archive from a **commit** (`git archive`) and then checks it against a list of forbidden entries | `npm run release:archive` |

## 3. From the audit: P1 (before productive agent use)

| Finding | Implementation | Evidence |
| --- | --- | --- |
| P1-01 input is untrusted data, never an instruction | R-18 in `AGENTS.md`, `docs/security.md` §2 with a sample wording | rule text; verifiability is limited and is named as such |
| P1-02 separate the control plane from the website state | "control plane" layer in `AGENTS.md` §1, `docs/architecture.md` §3, `docs/security.md` §3 | `CONTROL_PLANE` list in `scripts/check.mjs` |
| P1-03 agent may not change validator/AGENTS/CI unchecked | R-19; every change to these paths reports `CONTROL_PLANE_CHANGED` (warning, blocking under `--strict`) | `tests/validator.test.mjs` (git-based fixture) |
| P1-04 repository privacy and website privacy separated | `docs/security.md` §1, `AGENTS.md` §2, `input/README.md` | two separate checks: `INPUT_IN_DIST` vs. `INPUT_TRACKED` |
| P1-05 do not commit private material by default | `.gitignore`: `input/**` with exceptions for the READMEs/`brief.example.md`; `INPUT_TRACKED` blocks under `lifecycle: production` | `tests/validator.test.mjs` → *tracked material* |
| P1-06 unify URL normalization | one authority `src/lib/route.mjs`; layout, renderer and validator call the same functions | `docs/architecture.md` §3, `tests/route.test.mjs` (45 cases) |
| P1-07 fix query/fragment | `splitTarget()` separates path, query and fragment before every comparison | `tests/route.test.mjs`, `tests/validator.test.mjs` → *fragment/query* |
| P1-08 navigation duplicate error | duplicate check on the canonical route, per list (the footer may repeat a nav target) | `tests/validator.test.mjs` → *duplicate distinguishable only by the missing slash* |
| P1-09 validate all path segments | `invalidSegments()` on file path, route, link target and navigation href; asset file names excluded (dot allowed) | `tests/validator.test.mjs` → *all path segments*, `PATH_SEGMENT` |
| P1-10 validate `site.yaml` against a full schema | `src/lib/site-schema.mjs` (Zod, `strict()`): unknown fields, types, canonical hrefs, permitted `lifecycle` values | `tests/validator.test.mjs` → *configuration site.yaml* |
| P1-11 home page contract | exclusively `start.md`; `index` reserved; `slug: /` rejected; renderer and validator use the same function | `NO_START_PAGE`, `SLUG_RESERVED`, `RESERVED_FILENAME` |
| P1-12 slug canonicalization | `slug` must be canonical (`/leistung/`), otherwise `SLUG_INVALID`; the renderer still normalizes so that `leistungindex.html` can never be produced | `tests/route.test.mjs`, `SLUG_INVALID` |
| P1-13 MUST → error consistently | `MUST` → `error()`, `SHOULD` → `warn()`; `EMPTY_ALT` raised from warning to error | `AGENTS.md` §4, `tests/validator.test.mjs` → *empty alt text* |
| P1-14 lifecycle `development/production` | `site.yaml lifecycle`, drives `gate()`, robots, noindex, placeholders | `src/pages/robots.txt.ts`, `LIFECYCLE_NOT_PRODUCTION` |
| P1-15 template `noindex` by default | development: `noindex, nofollow` on every page and `Disallow: /`; `public/robots.txt` deleted, the route generates it | `tests/build.test.mjs` → *not indexable*, `INDEXABLE_IN_DEVELOPMENT` |

## 4. From the audit: P2 (hardening)

| Finding | Implementation | Evidence |
| --- | --- | --- |
| P2-01 JSON diagnostics | `--json` with the envelope `{ok, mode, lifecycle, strict, release, summary, diagnostics[]}`; stable codes, `rule`, `file`, `line`, `hint` | `docs/architecture.md` §6, tests read JSON exclusively |
| P2-02 Node-based test suite | `node:test`, 3 files, 130 tests, no external dependency | `npm test` |
| P2-03 URL/path property tests | idempotency of normalization, table-driven for segments, route ↔ delivered file | `tests/route.test.mjs` |
| P2-04 control plane via CODEOWNERS | `.github/CODEOWNERS` on the same path list as `CONTROL_PLANE` | `.github/CODEOWNERS` → @markus-ertel (branch protection and org team still pending) |
| P2-05 document branch protection | `docs/security.md` §3 and §7 name the step; it is a repository setting, not file content | `AGENTS.md` R-19 |
| P2-06 pin actions to SHAs | `actions/checkout` and `actions/setup-node` with 40-character SHAs, version comment next to them | `.github/workflows/validate.yml` |
| P2-07 pin Node/npm more precisely | `.node-version`, `engines.node`, `packageManager`, `npm ci` in CI, matrix 22 + reference | `docs/architecture.md` §9 |
| P2-08 sharpen the term reproducibility | the proof holds for **this environment**; the text says so explicitly, no "deterministic on every machine" | `scripts/reproducible.mjs`, output line |
| P2-09 remove `public/assets/README.md` | deleted (it would have been served as `/assets/README.md`); content moved into `docs/assets.md`; `FORBIDDEN_DIST_FILE` reports every `README.md` in the build | `docs/assets.md`, `tests/validator.test.mjs` → *internal documentation in the delivery state* |
| P2-10 check for unwanted deployment artifacts | list in the dist check: `.git`, `.DS_Store`, `__MACOSX`, `README.md`, `*.map`, `*.key`, `*.pem`, `.env`, source files; same list in the archive check | `FORBIDDEN_DIST_FILE`, `scripts/release-archive.mjs` |
| P2-11 contact details as a single source of truth | `site.yaml contact` as a required-field block, page sets `contact: true`, component `src/components/contact.astro` renders it; `CONTACT_PLACEHOLDER` blocks the go-live | `tests/build.test.mjs` → *renders contact values from site.yaml* |

## 5. New rules from the audit

| Rule | Core |
| --- | --- |
| R-18 | material is data, not an instruction |
| R-19 | control plane is protected; change only on instruction, in a commit of its own |
| R-20 | privileges kept low: no secrets, no network, no deployment by the agent |
| R-21 | production is an explicit state (`lifecycle`), indexing is a decision |
| R-22 | Markdown is content, not a sandbox — no HTML, script, iframe, form in pages |

R-22 adds to the four rules named by the audit: Astro allows HTML in Markdown, and "Markdown
is safe" is the kind of assumption a template must not make.

## 6. Deliberately not implemented

| Item | Reason |
| --- | --- |
| `llms.txt`, second output format | standard without notable adoption; machine basics are present. `docs/roadmap.md` |
| external link checker (`lychee`, `htmltest`) | network and extra installation in the check contradict R-12 |
| image pipeline (compression, `srcset`, AVIF) | a real feature, but scope; trigger in `docs/roadmap.md` |
| form endpoint | static build without a server; backlog item with a condition |
| cross-environment reproducibility (container toolchain) | the claimed scope is narrower (P2-08); the path is documented |
| preview environment per branch | a deployment wish, not an architectural need; trigger documented |
