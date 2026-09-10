#!/usr/bin/env bash
# Nachweis, dass die Checks ihre Fehlerfälle erwischen.
#
#   npm run selftest
#
# Jeder Fall verändert eine Kopie des Repos kaputt und verlangt einen roten
# Abschluss. Zwei Fälle verlangen grün: das unveränderte Template und eine
# Draft-Seite, die niemand verlinkt. Ohne diese Tests wäre die Sicherheitskette
# eine Vermutung.

set -uo pipefail

SRC=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
WORK=$(mktemp -d "${TMPDIR:-/tmp}/llm-cms-selftest.XXXXXX")
GNU_SED=false
sed --version >/dev/null 2>&1 && GNU_SED=true
pass=0
fail=0

cleanup() { rm -rf "$WORK"; }
trap cleanup EXIT

sedi() { # sed -i, auf macOS und Linux gleich
  if $GNU_SED; then sed -i "$1" "$2"; else sed -i '' "$1" "$2"; fi
}

reset() {
  rm -rf "$WORK/repo"
  mkdir -p "$WORK/repo"
  rsync -a --exclude node_modules --exclude dist --exclude .astro "$SRC/" "$WORK/repo/"
  ln -s "$SRC/node_modules" "$WORK/repo/node_modules"
  cd "$WORK/repo" || exit 1
}

expect_fail() {
  local out code
  out=$(eval "$2" 2>&1)
  code=$?
  if [ $code -ne 0 ]; then
    printf '  ✓ %-44s %s\n' "$1" "$(echo "$out" | grep -m1 '✗' | sed 's/^ *✗ *//' | cut -c1-80)"
    pass=$((pass + 1))
  else
    printf '  ✗ %-44s NICHT gefangen\n' "$1"
    fail=$((fail + 1))
  fi
}

expect_pass() {
  local out code
  out=$(eval "$2" 2>&1)
  code=$?
  if [ $code -eq 0 ]; then
    printf '  ✓ %-44s (korrekt grün)\n' "$1"
    pass=$((pass + 1))
  else
    printf '  ✗ %-44s fälschlich rot: %s\n' "$1" "$(echo "$out" | grep -m1 '✗\|ERROR' | cut -c1-70)"
    fail=$((fail + 1))
  fi
}

draft_page() {
  printf -- '---\ntitle: Entwurf\ndraft: true\ndescription: Ein hinreichend langer Beschreibungstext für den Entwurf.\n---\n\nVertraulicher Entwurf\n' >src/content/pages/entwurf.md
}

echo "== Quellenzustand =="

reset
printf '\nSiehe [Fehlende Seite](/gibt-es-nicht/).\n' >>src/content/pages/start.md
expect_fail "toter interner Link" "node scripts/check.mjs source"

reset
printf '\n![Bild ohne Alt](/assets/fehlt.png)\n' >>src/content/pages/start.md
expect_fail "fehlendes Asset" "node scripts/check.mjs source"

reset
printf -- '---\ntitle: x\ndescription: zu kurz\n---\n\n# H1 im Inhalt\n' >src/content/pages/bad.md
expect_fail "Frontmatter unvollständig" "node scripts/check.mjs source"

reset
printf '\n![Leeres Bild](/assets/bild.png)\n' >>src/content/pages/start.md
mkdir -p public/assets && echo bild >public/assets/bild.png
expect_fail "Bild ohne Alt-Text (strict)" "node scripts/check.mjs source --strict"

reset
printf -- '---\ntitle: Erste Seite\ndescription: Ein ausreichend langer Beschreibungstext hier.\nslug: /dopplung/\n---\n\nText\n' >src/content/pages/erste.md
printf -- '---\ntitle: Zweite Seite\ndescription: Ein ausreichend langer Beschreibungstext hier.\nslug: /dopplung/\n---\n\nText\n' >src/content/pages/zweite.md
expect_fail "zwei Seiten, dieselbe URL" "node scripts/check.mjs source"

reset
sedi 's|href: /kontakt/|href: /kontakt|' site.yaml
expect_fail "Navigation ohne abschließenden Slash" "node scripts/check.mjs source --strict"

reset
sedi 's|href: /kontakt/|href: /unbekannt/|' site.yaml
expect_fail "Navigation ohne Ziel" "node scripts/check.mjs source"

reset
draft_page
printf '\nSiehe [Entwurf](/entwurf/).\n' >>src/content/pages/start.md
expect_fail "Link auf Draft-Seite" "node scripts/check.mjs source"

reset
draft_page
sedi 's|href: /kontakt/|href: /entwurf/|' site.yaml
expect_fail "Navigation zeigt auf Draft" "node scripts/check.mjs source"

reset
mkdir -p public/input && echo "vertraulich" >public/input/lohnlisten.txt
expect_fail "input/ im Auslieferungsbereich" "node scripts/check.mjs source"

reset
echo "vertrauliche Gehaltsliste" >input/gehalt.txt && cp input/gehalt.txt public/assets/gehalt.txt
expect_fail "Material aus input/ in public/ (strict)" "node scripts/check.mjs source --strict"

reset
# Wird zusammengesetzt, damit dieser Test den eigenen Secret-Scan nicht auslöst.
DASHES=-----
printf '%sBEGIN RSA PRIVATE KEY%s\nabc\n' "$DASHES" "$DASHES" >config.pem
expect_fail "Schlüsseldatei im Repo" "node scripts/check.mjs source"

reset
printf 'token = "%s-%s"\n' "sk" "abcdefghijklmnopqrstuvwxyz0123456789" >notizen.txt
expect_fail "Token in einer Textdatei" "node scripts/check.mjs source"

reset
grep -v '^dist/' .gitignore >.gitignore.new && mv .gitignore.new .gitignore
expect_fail "dist/ nicht gitigoriert" "node scripts/check.mjs source"

reset
rm src/content/pages/start.md
expect_fail "Startseite fehlt" "node scripts/check.mjs source"

reset
sedi 's|^url: "https://example.com".*|url: "http://example.com/"|' site.yaml
expect_fail "Domain in http oder mit Slash" "node scripts/check.mjs source"

reset
sedi 's|^name: .*||' site.yaml
expect_fail "site.yaml ohne name" "node scripts/check.mjs source"

echo "== Schema (astro) =="

reset
printf -- '---\ndescription: ohne Titel im Frontmatter-Test\n---\n\nText\n' >src/content/pages/ohne-titel.md
expect_fail "Pflichtfeld title fehlt" "npx astro sync"

echo "== Build und Ausgabe =="

reset
expect_pass "unverändertes Template" "npx astro build && node scripts/check.mjs dist"

reset
draft_page
expect_pass "Draft bleibt draußen" "npx astro build && node scripts/check.mjs dist"

reset
sedi 's|^title: Start|title: Start\ndraft: true|' src/content/pages/start.md
expect_fail "Startseite als Draft" "npx astro build"

reset
npx astro build >/dev/null 2>&1
rm -f dist/leistungen/index.html
expect_fail "Seite fehlt im Build" "node scripts/check.mjs dist"

reset
npx astro build >/dev/null 2>&1
sedi 's|</main>|<a href="/verlust/">alt</a></main>|' dist/index.html
expect_fail "totes Ziel im fertigen HTML" "node scripts/check.mjs dist"

reset
npx astro build >/dev/null 2>&1
sedi 's|</main>|<h1>zu viel</h1></main>|' dist/index.html
expect_fail "zwei h1 im fertigen HTML" "node scripts/check.mjs dist"

reset
npx astro build >/dev/null 2>&1
mkdir -p dist/.astro && touch dist/.astro/junk
expect_fail "generierte Dateien im dist" "node scripts/check.mjs dist"

reset
echo "vertrauliche Gehaltsliste" >input/gehalt.txt
npx astro build >/dev/null 2>&1
cp input/gehalt.txt dist/gehalt.txt
expect_fail "input-Inhalt im dist" "node scripts/check.mjs dist"

reset
sedi 's|https://example.com/sitemap.xml|https://andere.example/sitemap.xml|' public/robots.txt
expect_fail "robots.txt passt nicht zur Domain" "npx astro build && node scripts/check.mjs dist --strict"

echo
echo "Ergebnis: $pass bestanden, $fail nicht gefangen"
[ $fail -eq 0 ]
