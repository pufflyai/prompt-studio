#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
bunx changeset version
bun run --cwd scripts release:stamp-dates
bun run --cwd scripts release:platforms:sync
bun run --cwd scripts release:desktop:sync
# update the lock file
bun install
bun run --cwd scripts release:lockfile:sync
bun run --cwd scripts verify:lockfile
