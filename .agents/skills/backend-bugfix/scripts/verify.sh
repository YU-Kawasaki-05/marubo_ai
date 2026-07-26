#!/usr/bin/env bash
set -euo pipefail

echo "Running repository-aware verification flow..."

# Prefer workspace test/lint when a JS package manifest exists.
if [[ -f package.json || -f pnpm-workspace.yaml ]]; then
  if command -v pnpm >/dev/null 2>&1; then
    pnpm lint
    pnpm test
    exit 0
  fi

  if command -v npm >/dev/null 2>&1; then
    npm run lint
    npm test
    exit 0
  fi

  echo "Package manifest found but neither pnpm nor npm is available."
  exit 1
fi

# Docs-first fallback: no application package is present yet.
echo "No package manifest found; skipping lint/test. Verify doc consistency manually."
