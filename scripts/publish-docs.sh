#!/usr/bin/env bash
# Assemble docs/ for publishing.
# Pages serves from main:/docs, so docs/ is committed while dist/ stays ignored.
# Once Pages is switched to the Actions workflow (.github/workflows/pages.yml),
# this and docs/ are no longer what the preview serves.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

# check.mjs runs the build itself, so it can never approve a stale dist/.
# Fail rather than publish a site that does not pass its own checks.
node scripts/check.mjs

rm -rf docs
cp -R dist docs

scripts/assemble-preview.sh docs

echo "docs/ assembled:"
find docs -type f | sort
