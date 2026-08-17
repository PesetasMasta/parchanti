#!/usr/bin/env bash
# Assemble docs/ for publishing.
# Pages serves from main:/docs, so docs/ is committed while dist/ stays ignored.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# check.mjs runs the build itself, so it can never approve a stale dist/.
# Fail rather than publish a site that does not pass its own checks.
node scripts/check.mjs

rm -rf docs
cp -R dist docs

# Skip Jekyll: plain files, and it would eat the underscore-prefixed _astro/.
touch docs/.nojekyll

# A site carrying unverified cast names does not belong in a search index.
cat > docs/robots.txt <<'EOF'
User-agent: *
Disallow: /
EOF

echo "docs/ assembled:"
find docs -type f | sort
