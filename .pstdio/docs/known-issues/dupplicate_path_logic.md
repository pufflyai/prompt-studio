# Duplicate Path Logic

## `~/.pstdio` default data directory

The default data directory (`~/.pstdio`) is resolved in two places:

1. **`pstdio-db`** — `packages/pstdio-db/src/db/paths.ts` (`resolveDbPath`)
2. **`pstdio` CLI** — `packages/pstdio/src/adapters/cli/dashboard/state-paths.ts` (`resolveDefaultDbPath`, `resolveDefaultStoragePath`)

### Why it's duplicated

The CLI can't import from `pstdio-db` — it would pull in Drizzle/PGlite and bloat the bundle. The CLI only needs the paths to pass as environment variables (`PSTDIO_DB_PATH`, `PSTDIO_STORAGE_PATH`) to the spawned API process.

### Risk

If the default path convention changes in `pstdio-db`, the CLI's `state-paths.ts` must be updated manually.

### Future

Consider extracting a tiny shared package (e.g. `pstdio-paths`) with zero dependencies that both can import from.
