# Architecture

**Languages:** English (default) · [Deutsch](architecture.de.md)

Reference architecture of the minimal variant. The origin story is in `docs/llm-cms.md`,
the criticism of v0.1 in `docs/feedback.md` and in the audit; this document describes the
state that resulted from them.

## 1. Who owns what

| Task | Owner | own code |
| --- | --- | --- |
| Frontmatter schema in the build | Astro Content Layers (`src/content.config.ts`) | 23 lines |
| Rendering, routes, assets | Astro | 0 lines |
| Site metadata | `site.yaml` + `src/lib/site-schema.mjs` | schema |
| URL normalization | `src/lib/route.mjs` | one authority |
| Checks | `scripts/check.mjs` | yes |
| Reproducibility proof | `scripts/reproducible.mjs` | yes |
| Release archive | `scripts/release-archive.mjs` | yes |
| Rules for agents | `AGENTS.md` | — |

A compiler of our own, a CLI of our own or an admin UI deliberately do not exist (R-17).
The part we own is small, deterministic and runs without network access.

## 2. Layers

```text
input/          raw material, trust boundary, untracked by default
   ↓ agent transfers meaning, human approves
site.yaml       name, domain, language, lifecycle, navigation, contact
src/content/    Markdown pages (content, no HTML — R-22)
src/layouts/    one layout, one heading, robots meta from lifecycle
src/components/ contact block (single source of truth from site.yaml)
src/pages/      routes: [...slug], index, sitemap.xml, robots.txt
public/         served unchanged (assets, favicon)
   ↓ astro build
dist/           disposable, never committed
```

## 3. One authority for URLs

`src/lib/route.mjs` is the only place that turns a file into a URL and a link into a file
target. It provides:

| Function | Contract |
| --- | --- |
| `splitTarget(href)` | separates path, query and fragment — query and fragment are never part of the route |
| `canonical(path)` | canonical route or `null`; idempotent, accepts only `a-z 0-9 - /` |
| `invalidSegments(path)` | segments that violate R-10 (capitals, umlauts, spaces, `..`, percent) |
| `routeForPage(id, slug)` | home page is `start.md` → `/`, otherwise `/path/` |
| `outputFileFor(route)` | `/` → `index.html`, `/a/` → `a/index.html` |
| `isPagePath(path)` | page or asset |

The layout (`src/lib/page.ts`, `src/layouts/page.astro`), the renderer (`src/pages/*.astro`)
and the validator (`scripts/check.mjs`) call **the same** function. v0.1 had two routing
logics: the validator accepted `start.md` as the home page, the renderer needed `index.md`.
Such a break is now structurally excluded, not merely tested.

`page.ts` is TypeScript for Astro, `route.mjs` is plain JavaScript — that is how renderer
and validator use the same code without any translation step.

## 4. Schema for site.yaml

`src/lib/site-schema.mjs` (Zod) permits only: `name`, `tagline`, `url`, `language`,
`lifecycle`, `nav`, `footer`, `contact`. `strict()` means: an unknown field is an error. A
navigation written under `navi:` is not a piece of dead configuration but a diagnostic
(`SITE_YAML_INVALID`) — including the path (`site.yaml → navi`).

The validator also uses the parsed object for content a schema cannot check: duplicates per
navigation list, target existence, placeholder domain, contact values. On a schema error the
raw value is used to keep checking, so one error does not hide the remaining findings; the
error stays and blocks.

## 5. Lifecycle

```text
lifecycle: development (default)   →  robots: Disallow: /   +  noindex on every page
lifecycle: production              →  robots: Allow: / + sitemap, no noindex meta
```

Derived from this: severities (`gate()`), placeholder handling, contact placeholders,
indexing checks. `npm run check:release` requires `lifecycle: production` and otherwise
reports `LIFECYCLE_NOT_PRODUCTION`.

## 6. Diagnostics

A diagnostic is a record, not a sentence:

```json
{
  "severity": "error",
  "code": "DEAD_INTERNAL_LINK",
  "rule": "R-08",
  "file": "src/content/pages/start.md",
  "line": 9,
  "target": "/does-not-exist/",
  "message": "dead internal link in line 9: /does-not-exist/",
  "hint": "create the page, remove the link, or correct the target"
}
```

`--json` returns the envelope:

```json
{ "ok": false, "mode": "source", "lifecycle": "development",
  "strict": false, "release": false,
  "summary": { "errors": 1, "warnings": 3, "notes": 1 },
  "diagnostics": [ … ] }
```

The rules for this:

- **Code names are stable.** `SCREAMING_SNAKE`, no `E-`/`W-` prefix (severity has its own
  field), never renumbered, never without a rule reference.
- **`rule`** points into `AGENTS.md`; a diagnostic without a rule is an opinion.
- **`line`/`target`** are included when the location is known — tests check them.
- **`hint`** is the repair, not a repetition of the finding.
- Exit codes: `0` fine, `1` blocked, `2` faulty invocation. An unknown mode is `2` with
  `UNKNOWN_MODE` — being able to check does not mean letting things through (fail-closed).

## 7. Check models

| Mode | Question | Blocks on |
| --- | --- | --- |
| `source` | is the state consistent? | MUST violations |
| `dist` | is the output correct? | MUST violations |
| `--strict` | additionally: are the SHOULD expectations met? | also warnings |
| `--release` | is this a go-live? | also `lifecycle: development`, placeholders, contact gaps |

## 8. Test layers

| Layer | File | Proof |
| --- | --- | --- |
| Units | `tests/route.test.mjs` | URL normalization, segments, idempotency, reserved names |
| Contract | `tests/validator.test.mjs` | every rule has a failure case with code, file, line |
| Integration | `tests/build.test.mjs` | a real Astro build, dist check, template not indexable, contact from `site.yaml` |

Fixtures are real project copies in a temporary directory (`tests/fixtures/base`), not text
bent with `sed`. Every test is independent, no ordering, no shared directory. The harness is
`node:test` — no bash, no `mktemp`, no dialects. A test that only asserts "exit not 0" counts
as insufficient: the named finding is expected.

## 9. Environment

Reproducibility needs a pinned environment, otherwise the proof is a statement about chance.

| Pinned by | Value |
| --- | --- |
| Node | `.node-version` (reference), `engines.node >= 22.12` |
| npm | `packageManager` in `package.json` |
| Dependencies | `package-lock.json`, CI with `npm ci` |
| CI actions | SHA pinning in `.github/workflows/validate.yml` |

`npm run reproducible` compares two builds **in this environment** and says so in its output.
Cross-environment reproducibility (different operating system, different Node version, a
build in three years) is not claimed; the road there would be a container image with the
exact toolchain — deferred in `docs/roadmap.md`.

## 10. Decisions and their reasons

| Decision | Reason | Alternative, rejected |
| --- | --- | --- |
| Astro instead of Hugo | content layer schema in the build, Node present, no extra toolchain | Hugo (more to install, no schema), own compiler (R-17) |
| `start.md` as the only home page | one home page, no two truths | `index.md` (Astro convention) — collides with `src/pages/index.astro` |
| YAML instead of `astro:config` JSON | humans read it and agents edit it cleanly | `astro.config.ts` (code as configuration) |
| own checks instead of `lychee`/`htmltest` | no network, no extra installation, deterministic | external link checkers (network in the build, R-12) |
| `input/` ignored by default | the repository boundary is the expensive one | committing it (publishes raw material) |
| tests in `node:test` | no runner, no bash dependency, codes verifiable | bash self-tests (v0.1: false positives, no codes) |
| one URL authority | renderer and validator cannot drift apart | duplicated logic (the v0.1 error) |

## 11. What this architecture is not

No CMS product, no multi-tenancy, no login, no workflow engine, no preview server, no
database, no publishing via API. The reasoning and the conditions for each addition:
`docs/roadmap.md`.
