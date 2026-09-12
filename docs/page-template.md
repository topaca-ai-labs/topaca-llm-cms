# Page template

**Languages:** English (default) · [Deutsch](seitenvorlage.de.md)

Copy to `src/content/pages/<name>.md`, then fill it in. The file name determines the URL:
`services.md` → `/services/`, `team/anna.md` → `/team/anna/`. (The pages bundled with this
template are German demo placeholders: `leistungen.md` → `/leistungen/`.) The home page is
**exclusively** `start.md`; `index` is a reserved name and `slug: /` cannot replace it
(R-06, R-10).

```markdown
---
title: Page title                                      # required, 2–70 characters
description: One sentence that shows what is here.     # required, 20–200 characters
slug: /optional-own-path/                              # optional; canonical only, with trailing slash
draft: false                                           # true = stays in the repo, does not appear
noindex: false                                         # true = additionally hidden from search engines
contact: false                                         # true = renders the contact values from site.yaml
sources:                                               # evidence for statements on this page
  - input/documents/brochure-2026.pdf                  # must exist and must be inside input/
updated: 2026-01-01                                    # optional, set by humans
---

## Heading

Content starts at `h2`; the layout supplies the `h1` from `title`.

Write internal links absolute: [To the services page](/services/).
Anchors: [Details](/services/#details) — the target is checked in the build.
Always give images alt text: ![What you can see](/assets/image.png).
```

## What the schema enforces

`src/content.config.ts` is binding: `astro sync` and `astro build` fail when frontmatter is
missing or contradicts the schema. `scripts/check.mjs` additionally reports the places a
schema cannot see (dead links, reachability, path segments, placeholders).

| Field | Rule |
| --- | --- |
| `title` | 2–70 characters, becomes the `h1` and the `<title>` |
| `description` | 20–200 characters, describes **this** page, not the brand |
| `slug` | canonical only: `/` or `/path/`, lowercase, kebab-case, no umlauts |
| `draft` | does not appear in the build; links to drafts are errors |
| `noindex` | the page's meta robots; under `lifecycle: development` everything is blocked anyway (R-21) |
| `contact` | `true` renders `site.yaml → contact`; never write the values into the page (R-05) |
| `sources` | paths inside `input/`, must exist; evidence duty per R-07 |
| `updated` | optional date set by humans; the build produces no timestamps (R-12) |

## Content is content (R-22)

Astro allows HTML in Markdown. This website does not use that:

- no `<script>`, `<iframe>`, `<form>`, `<object>`, no `javascript:` URL, no `on…` event handlers
- no inline styling (R-09)
- whatever looks like presentation belongs in the layout or in a component — both are control
  plane and therefore not an agent building content's business (R-19)

The validator reports such constructs as `UNSAFE_MARKDOWN`. The reason is not fear of our own
content but the fact that material of unknown origin from `input/` becomes content (R-18):
anything that gets through as HTML is executed in the browser.

## Check

```bash
npm run validate   # source state
npm run build      # build and output
npm test           # toolchain
```

## After creating the page (R-08)

- [ ] added under `nav:` or `footer:` in `site.yaml`, if it should be visible
- [ ] linked from at least one other page (otherwise `UNREACHABLE`)
- [ ] `description` describes the page, not the brand core
- [ ] no statement without evidence; `sources:` names the material (R-07)
- [ ] no HTML in the Markdown (R-22)
- [ ] contact values not copied but `contact: true` (R-05)
