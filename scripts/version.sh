#!/usr/bin/env bash
set -euo pipefail
bunx changeset version
bun run scripts/sync-platform-versions.ts
# update the lock file
bun install
