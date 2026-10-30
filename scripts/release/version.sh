#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
bun ./scripts/release/align-release-baseline.ts
# `--nightly` versions main as a snapshot prerelease; the remaining steps are shared.
if [ "${1:-}" = "--nightly" ]; then
  bun ./scripts/release/version-nightly.ts
else
  bunx changeset version
fi
bun run --cwd scripts release:stamp-dates
bun run --cwd scripts release:platforms:sync
# update the lock file
bun install
bun run --cwd scripts release:lockfile:sync
bun run --cwd scripts verify:lockfile
# Refresh distributable previews for the version commit; fingerprints remain local.
bun x --no-install lerna run build --scope canvas --include-dependencies
