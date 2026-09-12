# Backlog

**Languages:** English (default) · [Deutsch](roadmap.de.md)

What this minimal variant deliberately does not contain, why not, and what the trigger would
be. Every item is a decision, not an oversight.

## Deferred because the tool does not deliver the benefit

**`llms.txt` and a second output format.** The pattern describes a "machine web" output next
to the HTML. The standard for it is not adopted: providers do not pick it up, and a second
output doubles the build logic without anyone reading from it today. Instead this website
supplies what machines actually evaluate: semantic HTML, `lang`, canonical links, meta
descriptions, sitemap, `robots.txt` from the lifecycle. *Trigger:* an evaluator that
demonstrably benefits.

**External link checker (`lychee`, `htmltest`).** Also checks external targets but needs an
installation and makes the check depend on the network. The built-in check covers everything
that has to lie in the repo, offline and deterministically. *Trigger:* frequently broken
external targets, or a claim of checking outgoing links.

**Cross-environment reproducibility.** `npm run reproducible` compares two builds in the same
environment (`.node-version`, `packageManager`, lockfile) and says so. A more ambitious proof
needs a fixed container image with the exact toolchain and a hash comparison across operating
systems — its own topic, not a typo. *Trigger:* two environments whose builds differ and where
that has to count.

## Deferred because the need is not there yet

**Second layout or components.** One page, one layout, one stylesheet, one contact component.
As long as every page has the same structure, a second rendering path is only a second way to
break something. *Trigger:* a page type with a different structure (blog list, appointment
page).

**Multilingualism.** The pattern names "add a new language" as a maintenance case. Astro has
an i18n concept for this, but here it would touch navigation, URL scheme, checks and content
at the same time. *Trigger:* a second language with a real audience and clarified translation
work.

**Forms, comments, search.** These require a server or a third-party service and thereby
privacy statements that are not made today. Contact runs through `site.yaml` (`contact:`) and
is rendered by pages with `contact: true`. *Trigger:* a concrete contact path with privacy
approval.

**Image optimization, art direction, metadata scrubbing.** No transformation, no sizes, no
formats, no EXIF removal. Images lie in `public/assets/` exactly as handed over — including
the metadata a photo can carry. *Trigger:* images larger than the page text, a need for crops,
or material from sources with embedded location data.

**Deployment workflows and per-branch preview.** No workflow for Pages, Netlify or S3, no
deploy preview per pull request. The build is a drawer of files; the choice of host is open,
and deployment is deliberately a step of its own (R-20). *Trigger:* a hosting decision.

**Forced control-plane protection.** `CODEOWNERS` (owner: @markus-ertel) and the
`CONTROL_PLANE_CHANGED` warning are prepared, but a file cannot set branch protection:
"require review from code owners" and "do not allow forced pushes" are repository settings and
must be set there. Organization-wide ownership additionally needs a team under
@topaca-ai-labs — an organization is not a valid owner in `CODEOWNERS`. Until then R-19 is a
rule with visibility, not a lock. *Trigger:* create the repository on GitHub, set team and
branch protection.

**Shadowing of the checks (mutation testing).** The test harness proves that every rule catches
its failure case. A tool that runs mutated validator versions against the tests would show the
gap a test list still leaves. *Trigger:* one rule that fails despite its test case.

**Several agents in parallel.** The boundary `input/` and the rule "one change per undertaking"
carry two to three agents. Lock notes, merge-conflict rules for `site.yaml` and a mandatory
review are only needed once collisions actually occur. *Trigger:* lost changes through parallel
work.

**Order in `input/`.** Four folders and a convention. No index, no tagging, no preview of PDFs.
*Trigger:* a material inventory that is unmanageable without search.

**Language of the diagnostic messages.** Codes, rule IDs and file paths are language-neutral;
the message texts the validator prints are German. Translating them changes the output of every
check and the expected values of every test — exactly the kind of change R-19 reserves for an
explicit instruction. *Trigger:* a user who reads diagnostics in English — then as a switchable
locale (default `en`), never as a fork of the message list.

## Decided (and why it stays that way)

| Question | Decision |
| --- | --- |
| Astro or Hugo | Astro — content-layer schema in the build, Node environment present |
| License and ownership | MIT (`LICENSE`), Copyright © 2026 Markus Ertel, TOPACA AI Labs |
| Home page | exclusively `start.md`; `index` reserved, `slug: /` rejected |
| `input/` in the repository | untracked by default (`input/**`), exceptions only for the READMEs and the brief template |
| Severities | `MUST` → error, `SHOULD` → warning; `--strict` raises warnings to blocking level |
| Indexing | always blocked in `lifecycle: development`; go-live requires `lifecycle: production` |
| Markdown in content | forbidden (R-22), because Astro passes HTML through and Markdown is no sandbox |

## Fundamental threshold

New dependencies, new scripts and new layers need an entry here with a trigger — and an answer
to the question from `docs/feedback.md`: *can this not be solved with the existing tooling as a
convention rather than as code?*
