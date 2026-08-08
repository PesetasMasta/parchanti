#!/usr/bin/env bash
# Rebuild both prototypes and assemble docs/ for GitHub Pages.
# Pages serves from main:/docs, so docs/ is committed while build/ stays ignored.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

node scripts/embed-data.mjs
node scripts/inline.mjs canvas
node scripts/inline.mjs

rm -rf docs
mkdir -p docs

# The canvas is the live direction, so it is the landing page.
cp build/parchant-canvas.html docs/index.html
# The earlier scrolling version, kept reachable for comparison.
cp build/parchant.html docs/scroll.html

# Skip Jekyll: these are plain files and underscore-prefixed names would be eaten.
touch docs/.nojekyll

# A mockup carrying unverified cast names does not belong in a search index.
cat > docs/robots.txt <<'EOF'
User-agent: *
Disallow: /
EOF

echo "docs/ assembled:"
ls -la docs | awk 'NR>3 {printf "%9d  %s\n", $5, $9}'
