# Assets

**Languages:** English (default) · [Deutsch](assets.de.md)

`public/assets/` is the place for published assets: images, PDFs, fonts.

`public/` is taken into the build by Astro unchanged. Whatever sits here is therefore
public — under the same path the website serves.

## Moving material in from `input/`

Material from `input/` does **not** land here automatically. Moving it in is a step of its
own (AGENTS.md R-04):

1. Look at the material: what is it? Who owns it? Is it meant for publication?
2. Prepare it if needed: cropped, compressed, meaningful file name, no embedded metadata from
   foreign systems (`docs/roadmap.md` lists image preparation as a deliberate backlog item —
   here the human decides).
3. Move it in and document it in the commit message: which `input/` folder the file came from
   and why it may be public (R-07).

The validator reports two things:

- `INPUT_IN_PUBLIC` — a folder such as `public/input/` exists, so material was placed into the
  delivery area unchanged.
- `INPUT_IDENTICAL_FILE` — a file here is byte-identical to a file in `input/`. That is a
  prompt to confirm, not a suspicion. It only recognizes completely identical files; one
  changed line escapes it. It is not a data-leak search (see `docs/security.md`).

## No documentation in `public/`

`README.md` files in `public/` are served along with everything else and can then be read via
the website. Internal notes belong in `docs/`. The build check reports every `README.md` in
the delivery state as `FORBIDDEN_DIST_FILE` (R-03).
