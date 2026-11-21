# Database Upgrades

Prompt Studio keeps local data in an embedded PGlite database. This page explains which databases a release opens and what happens to the others.

## The 0.46 baseline

The schema starts at one generated migration in `pstdio-db/drizzle`, the 0.46 baseline. A new schema change adds a generated migration on top of it with `bun run --cwd packages/pstdio-db db:generate`. Never edit migration SQL by hand.

Every database folder carries `.pstdio-engine.json`. It names the PGlite engine and the baseline:

```json
{ "format": 1, "engine": "pglite-0.4", "baseline": "0.46" }
```

## Homes from older releases

At startup, `prepareCurrentPgliteHome` (`pstdio-db/src/db/pglite-current-home.ts`) handles three cases:

| Data folder | What happens |
| --- | --- |
| Missing or empty | Restore the built empty database and mark it. |
| Marked with the current baseline | Open it and apply newer migrations. |
| Anything else | Retire it, then create an empty database. |

Retiring writes `backups/pre-0.46-<time>-<folder>/` next to the database:

- `export/tables/<schema>.<table>.jsonl`: every table, one JSON row per line.
- `export/extension-records/<project id>/<extension id>.jsonl`: extension records, such as tickets, decoded from their Yjs documents.
- `export/README.md`: how to bring data back with an agent.
- `database/`: the original folder.

The export runs in a separate worker (`pglite-export-worker.ts`) with the engine that wrote the folder. If it fails, startup writes `export-error.txt` and still moves the folder aside. Desktop shows the `retiring` phase while this runs. Startup emits `database_retiring` and `database_retired`.

Core has no import code. To restore old data, ask an agent to read the export and recreate what you need with the `pst` CLI.

## Changing the schema later

- Additive and ordinary changes: generate a migration on top of the baseline. Fresh databases and current homes both apply it.
- A change that would need a data repair for existing homes: prefer a schema that does not need one. If it is unavoidable, the repair ships as a generated migration, tested on a copy of a large real database first. See [the lesson from 0.46](../../lessons-learned/0018-in-place-upgrades-meet-real-data-last.md).
- A new baseline repeats the 0.46 process: squash, change the marker's `baseline`, and update the backup folder name. Decide it as a breaking release, in an ADR.

### Session workspace conversion

The app-storage migration replaces `workspace_sessions` with `sessions.workspace_id`.
Before changing the schema, startup writes and fsyncs the old link rows beside the
database. It selects the earliest link by creation time and ID as the current
workspace. Other workspace associations become normal session resource context
links, preserving existing link details. After restoration commits, the original
rows move to `<database>-migration-exports/workspace-sessions.jsonl`. This export
stays until explicitly removed. An interrupted conversion resumes from the durable
input. The original session fields and timestamps remain unchanged.

### Stable board ownership

Saved board views belong to `(project_id, extension_id, board_id)`, independent
of an installed provider. Native boards use a null extension ID. Saved defaults
use the view flag; built-in choices and the independent selection timestamp are
project preferences under that stable extension owner. Removing one provider
preserves this data while another provider remains, including a disabled one.

Before the schema change, startup resolves each old instance against its project
and writes durable conversion input. It retains original view rows and default
selections in `<database>-migration-exports/board-owners.jsonl` and
`board-defaults.jsonl`. If several old providers had different defaults for the
same stable board, the latest selection timestamp wins, then the greatest old
instance ID breaks a tie. Every view and its original timestamps remain. An
interrupted migration resumes before clients can read the rows.

The public core sync collections retain their `extension_instance_id` field name
as a serialization alias of the stable extension ID. They never store another
instance reference. Their default-row IDs derive from project, stable extension
and board. SDK view response fields are unchanged. Runtime identity recovery publishes updated
view rows and replaces old default sync IDs after the rename commits, including
built-in defaults with no saved view. Ordinary provider changes keep the same scope.

### File ownership conversion

Files carry their owner, optional scope and logical path directly. Skills use
`skill:<skill ID>` with a logical path. Extensions use their stable extension ID
with a scope encoded as `[scope type, scope ID]`. Removing a provider preserves
files while another provider for that owner remains, including a disabled one.

Before removing the released `skill_files` and `extension_files` relations,
startup captures their complete rows and file metadata. A matching file may keep
its ID. A file shared by independent owners or scopes gets independent byte
copies and deterministic new IDs. Host attachments keep their original file.
The alpha conversion changes secondary binding IDs; it retains every original
binding and its converted file ID/path in `<database>-migration-exports/`.
The `skill-files.jsonl`, `extension-files.jsonl`, `file-mappings/` and
`file-allocations/` exports stay until explicitly removed.

Copies stream through bounded buffers, verify the original size/hash, and fsync
bytes before publishing metadata. Missing original bytes remain missing at
independent paths. Conflicting metadata, occupied copy paths and invalid project
owners stop conversion without replacing data. Durable conversion input remains
until both ownership groups finish, allowing interrupted restoration to resume.
Public file response fields stay unchanged.

### File deletion recovery

File deletion locks the row and refuses files still referenced by a skill,
session or workspace. Before deleting metadata, the file service fsyncs a small
receipt and moves the bytes to a sibling staging name using a hard link. A failed
database transaction restores the original path. After commit, it removes the
staged bytes, readable aliases and receipt. Session checkpoint deletion uses the
same protocol within the session transaction.

Receipts live under the storage directory's `file-removals/` directory, separated
by the canonical database path. Startup replays only that database's receipts:
a surviving row restores bytes, and a removed row finishes deletion. Project,
path and inode conflicts retain the receipt and report a retryable failure.
Receipts survive until cleanup succeeds; they add no database table. Explicit
extension removal retries its receipts before removing the provider. A failed
startup cleanup is reported and does not prevent other tools from opening.
POSIX directory flushes qualify the publication order. Windows process replay is
supported; Windows power-loss durability remains unqualified under
[ADR 0104](../../adrs/0104-temporary-windows-database-publication-retries.md).

### Cleanup and disk maintenance

Startup applies schema migrations, copies reachable receipt nodes into files, and
applies extension identity renames before tools can open their data. The background
maintenance pass then removes copied index-node rows and documents belonging to
the retired `pstdio.personal-history` owner. Foreign keys remove the retired
documents' update journals and retry identities. Cleanup uses document metadata
and preserves local conversations and the current `logs-v1` and `logs-v2` owners.
It yields to workbench queries between batches and rediscovers remaining rows on
the next start if interrupted.

PGlite has no autovacuum. The first scheduled pass runs ordinary vacuum and
refreshes statistics one table at a time. Ordinary vacuum makes freed space
reusable within the database. A full rewrite can return more space to the
operating system. It requires an offline database open because PGlite's single
connection would block workbench queries for the duration of the rewrite.
`.pstdio-maintenance.json` records the last successful offline compaction.
Cleanup invalidates the marker before deleting rows so an offline pass can
reclaim the space after an interruption. See
[PostgreSQL vacuum](https://www.postgresql.org/docs/17/sql-vacuum.html) and
[PGlite's single connection](https://pglite.dev/docs/).

A home written by the latest published nightly must open in the next build. `packages/e2e/src/packaged/packaged-nightly-home.p1.test.ts` runs in the P1 packaged CLI suite in the merge queue and nightly validation. It downloads that nightly and creates a project with it. It then starts the candidate build on the same home and fails if the candidate retires it. If the nightly cannot be downloaded or cannot write a home, the test skips with a warning, so a broken nightly cannot block its own fix. A pull request that starts a new baseline adds the published marker to `deliberateRetirements` in that test, in the same pull request as its ADR. Remove the entry once a nightly with the new baseline ships. This way nightly users lose their home only after a recorded decision. The rule exists because the 0.46 baseline marker reached nightly users one day after the previous marker, and their homes were retired without a decision.

## Extension data belongs to extensions

The core database does not own extension data, so database code and migrations must not name extension ids. `pstdio-db/src/services/legacy-resource-links.ts` translates the released anchor arrays under [ADR 0061](../../adrs/0061-project-resource-anchors.md) until their grouped breaking removal. `pstdio-db/src/db/extension-owned-ids.p0.test.ts` fails when another file names a first-party extension id.

An extension that renames its own commands, schedules, or stored values ships its migration with the extension, using [versioned storage migrations](../extensions/0018-data-migrations.md) and `ctx.storage.migrate` ([ADR 0077](../../adrs/0077-extension-owned-data-migrations.md)). Since 0.46, `ctx.storage.readLegacy` always resolves to `undefined`.

See [ADR 0103](../../adrs/0103-database-baseline-replaces-in-place-upgrades.md) for the decision.
