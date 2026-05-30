#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
bunx changeset version
bun run --cwd scripts release:stamp-dates
bun run --cwd scripts release:platforms:sync
# update the lock file
bun install
