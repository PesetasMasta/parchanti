#!/usr/bin/env bash
# Assemble docs/ for GitHub Pages.
# Pages serves from main:/docs, so docs/ is committed while build/ stays ignored.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# Fail rather than publish a page that does not pass its own checks.
node scripts/check.mjs "file://$ROOT/prototype/index.html"

rm -rf docs
mkdir -p docs

# The scroll page is the direction. Assets are copied as-is: the page loads
# them relatively, so what is served is byte-identical to what was checked.
cp prototype/index.html docs/index.html
cp -R prototype/assets docs/assets

# The superseded canvas direction, kept reachable for comparison.
node scripts/inline.mjs canvas
cp build/parchant-canvas.html docs/canvas.html

# Skip Jekyll: these are plain files and underscore-prefixed names would be eaten.
touch docs/.nojekyll

# A mockup carrying unverified cast names does not belong in a search index.
cat > docs/robots.txt <<'EOF'
User-agent: *
Disallow: /
EOF

echo "docs/ assembled:"
find docs -type f | sort
