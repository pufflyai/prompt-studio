# Shared Path Logic

## `~/.pstdio` default data directory

The default data directory (`~/.pstdio`) is resolved by `pstdio-paths`.

Runtime packages import the shared helpers instead of duplicating the fallback chain:

- **`pstdio-db`** derives `pstdio.db`
- **`pstdio-storage`** derives `storage`
- **`pstdio` CLI** derives dashboard/API state paths before spawning local services
- **extension runtime code** derives `extensions`

### Why it is shared

The CLI cannot import from `pstdio-db` because that would pull in Drizzle/PGlite and bloat the bundle. `pstdio-paths` is the small zero-dependency package both sides can import safely.

### Configuration

Set `PSTDIO_HOME` to move the whole pstdio data root:

| Path | Default |
| ---- | ------- |
| home | `~/.pstdio` |
| database | `$PSTDIO_HOME/pstdio.db` |
| storage | `$PSTDIO_HOME/storage` |
| workspaces | `$PSTDIO_HOME/workspaces` |
| extensions | `$PSTDIO_HOME/extensions` |

Narrower overrides remain for targeted runtime/test setup:

- `PSTDIO_DB_PATH`
- `PSTDIO_STORAGE_PATH`
- `PSTDIO_FILES_ROOT`

Workspace paths are derived from `PSTDIO_HOME`.
