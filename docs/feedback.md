> Critique of the pattern, written by the same author as this template (Markus Ertel,
> [@markus-ertel](https://github.com/markus-ertel)) in response to the gist behind
> [`llm-cms.md`](llm-cms.md). This English text is a translation; the German original
> [`feedback.de.md`](feedback.de.md) stays the source of record.

**Languages:** English (default) · [Deutsch](feedback.de.md)

Short answer: no, the concept itself is not overthought — the architecture it describes is
even deliberately minimalist. The text only feels complex because it is an extended essay.
And yes: the realization is considerably simpler than the gist suggests — you get about 90%
of it today with standard tooling, without a toolchain of your own.

## What the gist actually describes

Reduce the essay to its technical substance and surprisingly little remains:

- A static site repository with `content/`, `templates/`, `assets/`
- A rule file (`AGENTS.md`) as a "constitution" for the agent
- An `input/` folder as the trust boundary between raw material and published content
- Three commands (`validate`, `build`, `preview`)
- Git for history, review and approval

At its core this is a static site generator plus conventions. The length of the document
comes from arguing the hypothesis ("intent instead of forms", "human web + machine web"),
not from architectural complexity. The gist itself warns against building a large framework —
that self-discipline is the most valuable part of the text.

## Which parts are already standard

Most of the building blocks exist today as finished, established solutions:

| Gist building block | Existing solution |
|---|---|
| `AGENTS.md` as the agent constitution | Already an open standard (now Linux Foundation), read by more than 20 agent tools, in use in more than 700,000 repositories  [rohitghumare](https://rohitghumare.com/blog/agents-md-best-practices/); Claude Code, Codex, Copilot and Windsurf support the format  [reddit](https://www.reddit.com/r/ClaudeCode/comments/1rlc8zi/agentsmd_standard/) |
| Deterministic `validate/build/preview` toolchain | Every static site generator (Astro, Hugo, Eleventy) delivers exactly that, plus link checkers such as htmltest or lychee |
| Repository-as-state, Git history | Flat-file and Git-based CMS approaches (Decap, TinaCMS) as well as established SSG workflows  [statichunt](https://statichunt.com/blog/how-to-build-websites-with-ai-coding-agents-that-non-technical-clients-can-actually-maintain) |
| Agent runs build and deploy | Ready-made agent skills that deploy static sites including a GitHub Actions workflow  [top-agent-skills](https://top-agent-skills.com/guides/deploy-static-site-to-github-pages-with-ai-agent) |
| "AI static site generator" as a category | Tools that work exactly like this already exist — including an automatically generated `CLAUDE.md` with content inventory, URL patterns and CLI commands  [seite](https://seite.sh/blog/ai-static-site-generator) |
| Machine web / Markdown output | Jeremy Howard's `llms.txt` proposal  [llmstxt](https://llmstxt.org/) — though with a caveat (see below) |

The genuine novelties of the gist are conceptual: the explicit `input/` trust boundary (raw
material never becomes public automatically) and the shift from CRUD to intent. Both are good
ideas — but neither needs a product of its own, only a folder and a paragraph in the rule
file.

## Where complexity actually threatens

The risk lies not in the pattern but in the reference implementation:

- **A CMS product of your own (TOPACA):** anyone building an own CLI with an own
  `init/validate/build` reproduces functionality that Astro or Hugo have matured for years —
  and risks exactly the framework the gist warns about. As a starter template plus a
  collection of conventions TOPACA makes sense; as a tool of its own, rather not.
- **Machine-web dual output:** two output formats from one source double the build logic. That
  can safely be deferred — `llms.txt` is not supported by any large LLM provider so far, and
  Google has explicitly stated it will not adopt the standard. [ahrefs](https://ahrefs.com/blog/what-is-llms-txt/)
- **Three-layer model:** separating input, canonical state and build cleanly is right, but a
  `.gitignore` rule plus a convention is enough. An enforcement tool of your own is only needed
  once several agents work in parallel.

## The simplest realization today

A minimal stack that implements the whole pattern without writing new software:

1. **Choose an SSG:** Astro or Hugo deliver build, preview, frontmatter validation and
   reproducible output for free
2. **`AGENTS.md` in the repo:** structure, rules, no-go claims, validation commands — exactly
   the "constitution" of the gist [arxiv](https://arxiv.org/html/2601.20404v2)
3. **`input/` convention:** create the folder, state in `AGENTS.md` that nothing from it goes
   into `content/` unchecked
4. **Deterministic checks:** htmltest or lychee for links and assets, plus a GitHub Action as
   the agent's repair loop
5. **Attach any agent:** Claude Code, Codex or — fitting your local-first approach — a local
   model via OpenCode; switching the model actually works here because the state is in the
   repository

That reduces "LLM-CMS" to: a template repository, a rule file and CI. The maintenance loop
described in the gist (six months later: new service, drop documents in, the agent integrates
them coherently across navigation, links and metadata) already runs on this stack today.

## Conclusion

The gist is not overthought — it is only argued in great detail. The architecture is
deliberately small, and the central insight ("what remains of the CMS once the agent is the
operator?") is legitimate and current. It becomes easier to realize mainly by not building
TOPACA as a CMS product of its own but as a lean starter template with `AGENTS.md`, an `input/`
convention and preconfigured validation on an existing SSG. Then the own development effort
ends up at perhaps ten percent of what the text implies — and that would be the best proof of
the gist's hypothesis.
