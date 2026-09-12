# LLM-CMS

**Languages:** English (original, written in English) · Deutsch: no German version of this
idea file exists

**Author:** Markus Ertel ([@markus-ertel](https://github.com/markus-ertel)). Published from the
gist [llm-cms.md](https://gist.github.com/markus-ertel/2b807c92971923d3494da0623dcf5a1b), first
published 9 September 2026. Apart from these two header lines, this copy is identical to the
gist; the copy in this repository is the version the project maintains.

**A pattern for websites built and maintained by LLM-powered software agents.**

> **The Agent is the CMS.
> The Repository is the State.
> The Toolchain enforces Mechanics.**

This is an idea file.

It is meant to be read, copied, discussed, and handed to a modern coding agent such as Pi, Codex, Claude Code, OpenCode, or a similar system.

It is not a complete specification for a particular content management system.

Instead, it explores a hypothesis:

> **What should a content management system look like when its primary operator is no longer a human using a graphical admin interface, but an AI software agent?**

An open-source reference implementation of this idea is being developed as **TOPACA CMS** under the **TOPACA AI-Lab** GitHub organization.

---

## The core idea

Most content management systems were designed for a world in which humans had to manage websites through graphical interfaces.

They typically provide:

* an admin dashboard,
* a database,
* forms and input fields,
* WYSIWYG editors,
* themes,
* plugins,
* user roles,
* a server-side runtime.

That made sense.

Humans needed a convenient abstraction over HTML, CSS, files, databases, and servers.

LLM-powered software agents change this assumption.

An agent does not need a WYSIWYG editor.

It does not need a page builder.

It does not need a plugin marketplace.

It may not even need a traditional CMS backend.

An agent can read files, write files, reorganize directories, generate Markdown, modify HTML, build CSS, classify images, change information architecture, and consistently edit hundreds of related files.

So an interesting question appears:

> **What remains of a CMS when the graphical administration layer is replaced by an intelligent software agent?**

The answer may be surprisingly small:

* a structured repository,
* open files,
* explicit rules,
* an AI agent,
* a small deterministic toolchain.

That is what I mean here by an **LLM-CMS**.

Its basic principle is:

> **The agent is the CMS.**

The website itself lives in understandable files inside a repository.

The agent manages those files.

A small deterministic toolchain makes sure those files produce a valid, reproducible website.

The model looks like this:

```text
Human Intent
     ↓
 AI Agent
     ↓
Website Repository
     ↓
Deterministic Toolchain
     ↓
   Build
     ↓
  Website
```

Or, even shorter:

> **The agent handles meaning.
> The toolchain handles mechanics.**

---

## Why call it an LLM-CMS?

LLM-CMS is less the name of a single software product and more a possible **architectural pattern**.

The idea starts from a few assumptions:

1. Modern software agents can understand structured repositories.
2. Content does not necessarily need to be managed through forms.
3. Natural-language intent can become the primary interface.
4. Git is an excellent system for versioning website state.
5. Semantic decisions can increasingly be delegated to agents.
6. Technical correctness should still be checked deterministically.
7. The production website should have as little runtime complexity as possible.

The LLM matters.

But the LLM alone is **not** the CMS.

The actual system is the combination of:

```text
LLM
+
Agent
+
Repository
+
Rules
+
Deterministic Toolchain
```

---

## Why not just let the agent write HTML?

You can.

For a small one-off website, it already works surprisingly well.

You can give a coding agent a brief and say:

> Build a modern website for this company.

A short time later, you have HTML, CSS, JavaScript, and perhaps even a polished design.

That is impressive.

But it solves the problem of **website creation**.

It does not necessarily solve the problem of **website management**.

The more interesting question is:

> What happens six months later?

What happens when:

* a new service is introduced,
* employees change,
* positioning changes,
* new photographs arrive,
* legal information changes,
* a new language is added,
* several agents work on the site,
* the original model is replaced by another model?

The agent now has to understand:

* what content already exists,
* which URLs belong to which pages,
* which templates are in use,
* where assets live,
* which material is allowed to be published,
* which files are only source material,
* which files are generated,
* which files represent canonical truth,
* which rules govern the website.

Without structure, each agent session slowly makes the project harder to understand.

The agent starts inventing things again.

It duplicates CSS.

It recreates components.

It edits generated output.

It accidentally publishes working material.

Or it spends every session reverse-engineering how the project works.

An LLM-CMS does not try to replace the agent with a large framework.

Instead, it gives the agent a:

> **small, stable, explicit, machine-readable working environment.**

---

## The repository is the state

In a traditional CMS, the real state of the website often lives inside a database.

In an LLM-CMS, the state primarily lives in files.

For example:

```text
site.yaml
content/
templates/
styles/
scripts/
assets/
AGENTS.md
```

Together, these files form the canonical state of the website.

They can be:

* versioned with Git,
* searched,
* diffed,
* copied,
* archived,
* read by humans,
* modified by agents,
* stored locally.

There is no hidden CMS database required to understand the site.

This leads to a strong principle:

> **If you own the repository, you own the website.**

Not the hosting company.

Not the CMS vendor.

Not the LLM provider.

The repository contains the durable state.

Models and agents can be replaced.

---

## Three layers

An LLM-CMS should clearly separate three different categories of data:

```text
Input
  ↓
Canonical Website State
  ↓
Build
```

This separation matters.

---

## 1. Input

`input/` contains material provided to the agent by humans.

For example:

```text
input/
├── brief.md
├── brand/
├── content/
├── media/
└── documents/
```

This may include:

* project briefs,
* logos,
* photographs,
* PDFs,
* existing copy,
* product information,
* brand guidelines,
* internal background documents,
* spreadsheets,
* presentations,
* raw material.

Input is **not published website content**.

A file being present in `input/` must never automatically mean that it becomes public.

That is an important trust boundary.

The human provides material.

The agent interprets it.

The agent deliberately transfers only relevant information into the canonical website state.

So:

```text
input ≠ website
```

Instead:

```text
input
  ↓
agent interpretation
  ↓
canonical website state
```

---

## 2. Canonical Website State

This is the actual website.

For example:

```text
site.yaml
content/
templates/
styles/
scripts/
assets/
AGENTS.md
```

These files are intentionally maintained by the human and the agent.

They may contain:

* content,
* page structure,
* URLs,
* templates,
* design rules,
* scripts,
* published assets,
* metadata,
* site configuration.

This layer is the:

> **Source of Truth.**

If an agent wants to understand the current website, it should inspect this layer.

Not the last generated build.

Not the input folder.

Not some hidden database.

The canonical state.

---

## 3. Build

`build/` contains generated output only.

For example:

```text
build/
├── index.html
├── services/
├── assets/
├── sitemap.xml
└── ...
```

The build is derived state.

It should be possible to delete it completely and regenerate it from the canonical source.

Therefore:

> **Generated files are never maintained manually.**

If the output is wrong, the source is fixed and the site is built again.

The direction should always be:

```text
Canonical State
      ↓
    Build
      ↓
Generated Website
```

Never:

```text
Generated Website
      ↑
manual edits
```

---

## One file explains the website to the agent

Every website needs a file that tells a new agent how the repository works.

That file might be called:

```text
AGENTS.md
```

or, in a specific implementation:

```text
TOPACA.md
```

Think of this file as the **constitution of the website**.

It can explain:

* what the website is trying to achieve,
* who the target audiences are,
* how the repository is structured,
* which files have which meaning,
* which claims must not be invented,
* how input material should be handled,
* which brand rules apply,
* how new pages are created,
* which files are generated,
* which files must never be edited directly,
* which quality standards must be met,
* which validation commands must be run.

This creates an important difference from a traditional website.

The repository contains not only content and code.

It also contains:

> **explicit instructions for how an AI agent should understand, modify, and maintain the system.**

The website becomes agent-readable.

---

## Initialization

A new website should not begin with an agent inventing a directory structure from scratch.

The toolchain should first create a known workspace.

Conceptually:

```bash
cms init my-website
```

Or in a concrete implementation:

```bash
topaca init my-website \
  --name "My Website" \
  --domain "https://example.com" \
  --language "en"
```

This creates the working structure.

The human can then place source material into `input/`.

Only then does the actual agent workflow begin:

```text
1. Initialize website

2. Add material to input/

3. Agent reads repository instructions

4. Agent inspects input/

5. Agent understands the organization,
   goals, and constraints

6. Agent creates or modifies the
   canonical website state

7. Toolchain validates the repository

8. Toolchain builds the website

9. Human and agent review the result

10. Agent improves the canonical state

11. Validate and build again
```

This loop can continue for the entire lifetime of the website.

---

## The agent handles meaning

Many website decisions cannot be usefully reduced to a rigid CMS schema.

For example:

* Which pages should this organization have?
* What belongs on the homepage?
* How should a complex service be explained?
* What navigation is easiest to understand?
* How should the brand feel visually?
* Is this image relevant?
* Should this long PDF become an FAQ?
* Which content is redundant?
* Which information is missing?
* Which statements are actually supported by the available sources?
* Which message should be more prominent?

These are semantic decisions.

They require understanding.

This is where an LLM-powered agent is useful.

An LLM-CMS should therefore avoid forcing every possible website decision into predefined fields and components.

> **If a task requires understanding, let the agent solve it.**

That goes far beyond writing individual paragraphs.

The agent can reason about the website as a whole.

---

## The toolchain handles mechanics

Other questions should never depend on the intuition of a language model.

For example:

* Are two URLs identical?
* Is a required file missing?
* Is an ID unique?
* Does the referenced template exist?
* Is this path allowed?
* Is the configuration valid?
* Do internal links resolve?
* Do referenced assets exist?
* Can the build be reproduced?

These are deterministic questions.

They belong to the toolchain.

Conceptually:

```bash
cms validate
cms build
cms preview
```

The agent can use these tools itself.

That creates a repair loop:

```text
Agent modifies website
          ↓
       validate
          ↓
        errors?
       ↙      ↘
     yes       no
      ↓         ↓
   Agent       build
  repairs        ↓
      ↑        Website
      └──────────┘
```

The language model does not need to be perfect.

It needs a system that makes mistakes visible and gives it a way to repair them.

---

## Determinism as a safety net

LLMs are probabilistic.

Websites should not be.

As much technical behavior as possible should remain deterministic.

The same canonical files should produce the same build.

An invalid URL should reliably fail validation.

A missing template should not sometimes work and sometimes fail.

A production website should not change because the model happened to make a different guess today.

This creates a useful division of labor:

```text
Probabilistic Intelligence
           +
Deterministic Infrastructure
           =
Agent-Compatible System
```

The agent gets freedom where creativity and understanding matter.

The toolchain imposes hard constraints where correctness matters more.

---

## Static-first

An LLM-CMS can treat the website primarily as a static artifact.

That does not mean the website can never contain dynamic features.

It means:

> **If something can be static, it probably should be.**

A company website does not need a permanently running CMS server just because somebody changes the copy once a month.

The agent modifies the source files.

The toolchain builds the website.

A web server or CDN serves the result.

The production server is no longer the CMS.

It is only a delivery target.

```text
Repository
    ↓
   Build
    ↓
Static Files
    ↓
CDN / Webserver / Hosting
```

---

## Local-first

Because the complete state of the website can live in ordinary files, an LLM-CMS can operate locally.

The agent can run locally.

The repository can live locally.

Git can be local.

The build can happen locally.

The finished site can then be deployed almost anywhere.

This makes the system fundamentally independent of:

* a specific cloud provider,
* a specific SaaS CMS,
* a specific coding agent,
* a specific LLM,
* a specific hosting vendor.

Today the agent might use a frontier model through an API.

Tomorrow it might use a local model.

Or several models together.

The durable state remains the repository.

---

## Model-agnostic

This leads to another important principle.

An LLM-CMS should know as little as possible about **which model currently operates it**.

The model should be replaceable.

```text
Claude
   \
 GPT ──→ Agent ──→ Repository
   /
Local LLM
```

A stronger model should be able to take over the same website.

A local model should be able to read the same rules.

Another agent should be able to understand what its predecessor did.

The repository becomes a shared memory between agents and models.

---

## Human Web and Machine Web

Websites are still primarily designed for humans.

But increasingly they are also read by machines:

* search engines,
* AI assistants,
* research agents,
* retrieval systems,
* shopping agents,
* enterprise agents.

An AI-native website should consider both audiences.

```text
              Website
             /       \
            /         \
      Human Web     Machine Web
         ↓              ↓
       HTML          Markdown
       Design        Metadata
       Navigation    Structured Content
       Interaction   Semantic Structure
```

This should not require maintaining two independent websites.

Both should be generated from the same canonical source.

```text
Canonical Content
      ↓
   ┌──┴──┐
   ↓     ↓
 HTML   Machine-readable
```

The website becomes not only responsive across screen sizes.

It becomes, in a sense:

> **semantically responsive to humans and machines.**

---

## Maintenance instead of regeneration

One of the most interesting properties of an LLM-CMS appears only **after launch**.

You might tell the agent:

> We now offer strategic AI consulting for small and medium-sized companies. Here are our internal documents. Review the existing website and integrate this new service wherever it makes sense. Only change factual claims when they are supported by our source material.

A traditional CMS does not understand what this change means.

It provides fields.

An agent can instead:

* analyze the new documents,
* inspect existing content,
* change the information architecture,
* update navigation,
* add pages,
* rewrite affected pages,
* update internal links,
* change metadata,
* select relevant media,
* remove redundancy,
* update machine-readable content,
* validate the build.

The website stops being a collection of editable pages.

It becomes a:

> **persistently maintained digital artifact.**

---

## The more interesting use case

“An AI can generate a website” is already becoming ordinary.

Many systems can do that.

The more interesting problem is:

> **Can an agent understand and maintain a website as one coherent system for years?**

That changes the problem completely.

The important question is no longer:

> Can AI generate HTML?

It becomes:

> Can an agent reliably understand, modify, validate, and evolve long-lived digital state?

That is the interesting CMS problem.

---

## Why this might work

The difficult part of maintaining a professional website is rarely storing a text field in a database.

The difficult part is keeping the entire system coherent over time.

When an organization changes, many things may need to stay synchronized:

* content,
* navigation,
* services,
* links,
* images,
* positioning,
* SEO,
* metadata,
* design,
* legal information,
* machine-readable representations.

Humans often change only the most obvious place.

An agent can inspect the entire repository and reason about all potentially affected locations.

That may turn out to be much more important than initial website generation.

Not:

> **“AI can generate a website.”**

But:

> **“AI can continuously understand and maintain a website as one coherent system.”**

---

## Git becomes the CMS history

If the website is a repository, its history naturally becomes inspectable.

Git can show:

* which content changed,
* when navigation changed,
* which templates were replaced,
* when a service was added,
* which files the agent touched.

Changes can be reviewed, compared, and reverted.

Branches can be used for experiments.

Pull requests can provide human approval.

```text
Agent
  ↓
Branch
  ↓
Changes
  ↓
Validation
  ↓
Review
  ↓
Merge
  ↓
Deploy
```

Version control becomes part of the content management process.

---

## A possible workflow

In practice, you might have a coding agent on one side of the screen and a local preview of the website on the other.

You say:

> The homepage still feels too much like a generic agency website. Analyze the available material and develop a clearer positioning. Do not invent claims that are not supported by our sources.

The agent reads:

```text
AGENTS.md
input/
site.yaml
content/
templates/
styles/
assets/
```

It first understands the existing state.

Then it changes the website.

Then it runs:

```bash
cms validate
cms build
```

The browser refreshes.

You discuss the result.

The agent improves it.

The CMS interface has changed from:

```text
Dashboard
→ Pages
→ Edit Page
→ Text Field
→ Save
```

to:

```text
Human
→ Conversation with Agent
→ Repository Changes
→ Validation
→ Build
→ Preview
```

The browser is the preview.

The agent is the website operator.

The repository is the website.

The toolchain is the deterministic safety layer in between.

---

## What an LLM-CMS should not be

An LLM-CMS should not simply be a traditional CMS with an AI chatbot added to it.

It is not necessarily:

> WordPress + chatbot

or:

> Headless CMS + LLM API

Those systems can absolutely be useful.

But they largely preserve the old CMS model.

A true LLM-CMS asks a more fundamental question:

> If an agent can understand files, code, content, and structure directly, which CMS abstractions do we still need?

It should also avoid becoming a huge framework that tries to implement every possible website feature itself.

The core engineering question should probably be:

> **What is the smallest deterministic toolchain an AI agent needs in order to reliably maintain a professional website over the long term?**

If a modern agent can reliably perform a task itself, the CMS may not need another abstraction for it.

The system should remain as small as possible.

But wherever consistency, safety, or reproducibility matter, the system should be strict and deterministic.

---

## The real shift

Traditional CMSs were designed for humans who **operate websites**.

An LLM-CMS is designed for humans who tell an agent **what they want to achieve**.

That changes the interface fundamentally.

Traditional:

```text
Human
  ↓
CMS Interface
  ↓
Forms
  ↓
Database
  ↓
Template Engine
  ↓
Website
```

LLM-CMS:

```text
Human
  ↓
Intent + Material
  ↓
AI Agent
  ↓
Open Website Repository
  ↓
Deterministic Toolchain
  ↓
Website
```

The primary interface is no longer the form.

> **It is language.**

---

## From CRUD to Intent

Traditional CMSs are often fundamentally CRUD systems:

```text
Create
Read
Update
Delete
```

The human is responsible for knowing:

* which object to modify,
* which page is affected,
* which field to edit,
* which other locations should also change.

An LLM-CMS moves interaction one level higher.

The human expresses an **intent**.

For example:

> We are repositioning the company from a traditional advertising agency to an AI consultancy.

That is not a CRUD operation.

It is a goal.

The agent has to derive the necessary work:

```text
Intent
  ↓
Analyze Existing State
  ↓
Plan
  ↓
Multiple Related Changes
  ↓
Validation
  ↓
Build
```

This may ultimately be the most important change in the CMS concept:

> **Content Management becomes Intent Management.**

---

## TOPACA CMS

**TOPACA CMS** is an open-source reference implementation of the LLM-CMS idea.

It does not attempt to prove that there is exactly one correct architecture.

Instead, it explores which minimal structures and tools are necessary for modern coding agents to build and maintain websites reliably.

The work is being developed publicly under:

**TOPACA AI-Lab**

https://github.com/topaca-ai-lab

TOPACA follows principles such as:

```text
Agent-as-CMS
Repository-as-State
Local-first
Static-first
Model-agnostic
Files over Database
Intent over Forms
Determinism for Mechanics
LLM for Semantics
Human Web + Machine Web
```

TOPACA is not the definition of LLM-CMS.

It is an experiment and a concrete implementation of the pattern.

Other implementations could use:

* different programming languages,
* different directory structures,
* different build systems,
* different agents,
* different LLMs,

while still following the same basic idea.

---

## Why open source?

If the principle is:

> **If you own the repository, you own the website,**

then tying the underlying CMS entirely to a proprietary service would be contradictory.

An open-source reference implementation enables:

* independent experimentation,
* alternative implementations,
* local LLM use,
* different coding agents,
* reproducible builds,
* long-term data ownership,
* community development.

It is also far from obvious what the ideal LLM-CMS architecture actually looks like.

That is probably better discovered through working systems than through a large specification written in advance.

---

## The experiment

The real research question behind TOPACA is not:

> How do we build another CMS?

It is:

> **How much CMS do we still need when software agents become increasingly capable?**

Maybe much less than before.

Perhaps the eventual system is mostly:

```text
files
+
git
+
agent instructions
+
validation
+
build
```

with a capable agent on top.

Or perhaps experiments will show that some traditional CMS concepts remain essential.

That should be discovered empirically.

---

## The long-term idea

Maybe, in a world of capable software agents, a “CMS” eventually stops being an application.

Maybe it becomes only:

* a well-structured repository,
* a contract explaining how that repository works,
* an intelligent agent,
* and a small set of deterministic tools.

In that world, the CMS is no longer simply the place where content is stored.

It becomes the:

> **protocol between human intent, an AI agent, and persistent digital state.**

That is the hypothesis behind LLM-CMS.

```text
The Agent is the CMS.

The Repository is the State.

The Toolchain enforces Mechanics.

The Build is Disposable.

The Server is only the Delivery Target.

The Human provides Intent.

The Agent maintains the System.
```

---

## Try it

This document deliberately describes a pattern, not a complete implementation.

Directory structures, schemas, templates, build pipelines, agents, and models will evolve.

The important part is not:

* a particular programming language,
* a particular framework,
* a particular agent,
* a particular LLM.

The important part is the separation of responsibilities:

> **The human provides intent and truth.**

> **The agent handles meaning.**

> **The repository stores state.**

> **The toolchain guarantees mechanics.**

> **The build produces the publishable artifact.**

Perhaps the best way to explore the idea is therefore the same way the idea itself suggests:

**Copy `llm-cms.md` into an empty directory.**

**Give it to a capable coding agent.**

**Add a brief, some text, and a few images.**

Then say:

> *Build me an LLM-CMS website based on this idea.*

And see what happens.

---

## Reference implementation

An open-source reference implementation of the **LLM-CMS pattern** is being developed as **TOPACA CMS**.

Source code, experiments, and related projects will be published through:

**TOPACA AI-Lab**

https://github.com/topaca-ai-lab

`llm-cms.md` is deliberately **not the TOPACA documentation**.

It describes the broader idea.

> **LLM-CMS is the pattern.**

> **TOPACA CMS is one implementation.**

---

*Inspired by Andrej Karpathy's LLM Wiki idea and by the broader question of what software should look like when AI agents become its primary operators.*
