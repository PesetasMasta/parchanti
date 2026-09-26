#!/usr/bin/env bash
# Turn a built site into the GitHub Pages preview, in place:
#   PREVIEW_BASE=/parchanti scripts/assemble-preview.sh <dir>
# Used by the Pages workflow (.github/workflows/pages.yml) on dist/.
set -euo pipefail

SITE="${1:?usage: scripts/assemble-preview.sh <dir>}"

# GitHub project Pages serve this repo under /parchanti/, but the site is
# authored with root-relative links for its own domain. Set PREVIEW_BASE to
# prefix them in the published copy only; the source and the
# kolekceparchant.cz build stay untouched.
PREVIEW_BASE="${PREVIEW_BASE:-}"
PREVIEW_BASE="${PREVIEW_BASE%/}"

if [ -n "$PREVIEW_BASE" ]; then
  # href/src/content for markup, url() for the font faces in the built CSS.
  # (?!/) leaves protocol-relative URLs alone; (?!$PREVIEW_BASE/) makes a
  # second run a no-op.
  find "$SITE" \( -name '*.html' -o -name '*.css' \) -type f -print0 |
    PREVIEW_BASE="$PREVIEW_BASE" xargs -0 perl -pi -e '
      my $b = $ENV{PREVIEW_BASE};
      s{(href|src|content)="/(?!/|\Q$b\E/)}{$1="$b/}g;
      s{url\((["'"'"']?)/(?!/|\Q$b\E/)}{url($1$b/}g;
    '
  echo "rewrote root-relative links to $PREVIEW_BASE/"
fi

# Skip Jekyll: plain files, and it would eat the underscore-prefixed _astro/.
touch "$SITE/.nojekyll"

# A temporary address does not belong in a search index.
cat > "$SITE/robots.txt" <<'ROBOTS'
User-agent: *
Disallow: /
ROBOTS
