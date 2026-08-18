#!/usr/bin/env bash
# Assemble docs/ for publishing.
# Pages serves from main:/docs, so docs/ is committed while dist/ stays ignored.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# GitHub project Pages serve this repo under /parchanti/, but the site is
# authored with root-relative links for its own domain. Set PREVIEW_BASE to
# prefix them in the published copy only; the source and the
# kolekceparchant.cz build stay untouched.
PREVIEW_BASE="${PREVIEW_BASE:-}"
PREVIEW_BASE="${PREVIEW_BASE%/}"

# check.mjs runs the build itself, so it can never approve a stale dist/.
# Fail rather than publish a site that does not pass its own checks.
node scripts/check.mjs

rm -rf docs
cp -R dist docs

if [ -n "$PREVIEW_BASE" ]; then
  # href/src/content for markup, url() for the font faces in the built CSS.
  # (?!/) leaves protocol-relative URLs alone; (?!$PREVIEW_BASE/) makes a
  # second run a no-op.
  find docs \( -name '*.html' -o -name '*.css' \) -type f -print0 |
    PREVIEW_BASE="$PREVIEW_BASE" xargs -0 perl -pi -e '
      my $b = $ENV{PREVIEW_BASE};
      s{(href|src|content)="/(?!/|\Q$b\E/)}{$1="$b/}g;
      s{url\((["'"'"']?)/(?!/|\Q$b\E/)}{url($1$b/}g;
    '
  echo "rewrote root-relative links to $PREVIEW_BASE/"
fi

# Skip Jekyll: plain files, and it would eat the underscore-prefixed _astro/.
touch docs/.nojekyll

# A site carrying unverified cast names does not belong in a search index.
cat > docs/robots.txt <<'EOF'
User-agent: *
Disallow: /
EOF

echo "docs/ assembled:"
find docs -type f | sort
