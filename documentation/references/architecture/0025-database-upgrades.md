# Database Upgrades

Prompt Studio keeps local data in an embedded PGlite database. This page explains which databases a release opens and what happens to the others.

## The 0.49 baseline

The schema starts at one generated migration in `pstdio-db/drizzle`, the 0.49 baseline. A new schema change adds a generated migration on top of it with `bun run --cwd packages/pstdio-db db:generate`. Never edit migration SQL by hand.

Every database folder carries `.pstdio-engine.json`. It names the PGlite engine and the baseline:

```json
{ "format": 1, "engine": "pglite-0.4", "baseline": "0.49" }
```

## Homes from older releases

At startup, `prepareCurrentPgliteHome` (`pstdio-db/src/db/pglite-current-home.ts`) checks the data folder.

| Data folder | What happens |
| --- | --- |
| Missing or empty | Restore the built empty database and mark it. |
| Marked 0.49 | Open it and apply later migrations. |
| Marked 0.46 by a supported older host | Verify the released journal, convert the saved project data, and adopt the 0.49 baseline. |
| Anything else | Retire it, then create an empty database. |

Retiring writes `backups/pre-0.46-<time>-<folder>/` next to the database:

- `export/tables/<schema>.<table>.jsonl`: every table, one JSON row per line.
- `export/extension-records/<project id>/<extension id>.jsonl`: extension records, such as tickets, decoded from their Yjs documents.
- `export/README.md`: how to bring data back with an agent.
- `database/`: the original folder.

The export runs in a separate worker (`pglite-export-worker.ts`) with the engine that wrote the folder. If it fails, startup writes `export-error.txt` and still moves the folder aside. Desktop shows the `retiring` phase while this runs. Startup emits `database_retiring` and `database_retired`.

Restoring a retired pre-0.46 database requires manual recovery. An agent can read the export and recreate what you need with the `pst` CLI.

## Upgrading existing projects to 0.49

Fresh databases use one generated schema migration. The SQL and checksums in
`pstdio-db/drizzle-0.46` are frozen inputs for the one-time upgrade.
Published 0.46.0 and 0.47.0 databases can upgrade directly. They run the earlier
conversions they missed, then adopt the 0.49 baseline. The local-only reset
applies specifically to the later 0.48 storage format.

A settled 0.48 database is batch re-imported and its source is retained at
`<database>.before-0.49`. A database with pending edits uses the existing
conversion to materialize those edits. At this 0.48 boundary every project is local.
The active database retains live records, document contents, local history, attachment references and
uploads with staged bytes. Old save IDs, deleted records and sync positions expire together.
The attachment byte store remains available by content hash. A fully converted early 0.49 installation adopts the new journal
in place. Future schema changes build on the single 0.49 migration.

When upgrading from 0.46, 0.47 or 0.48, the host refreshes incompatible release-managed first-party
tools from its catalog. The installer preserves project selections, installation
IDs and settings. Local and third-party sources stay under the user's control.
The complete upgrade includes a successful saved project edit within 25 seconds.
The [baseline decision](../../adrs/0168-squash-the-0-49-database-baseline.md#removal)
defines when support for older database formats can be removed.

## Changing the schema later

- Additive and ordinary changes: generate a migration on top of the baseline. Fresh databases and current homes both apply it.
- A change that would need a data repair for existing homes: prefer a schema that does not need one. If it is unavoidable, the repair ships as a generated migration, tested on a copy of a large real database first. See [the lesson from 0.46](../../lessons-learned/0018-in-place-upgrades-meet-real-data-last.md).
- A new baseline repeats the 0.46 process: squash, change the marker's `baseline`, and update the backup folder name. Decide it as a breaking release, in an ADR.

### Session workspace conversion

The app-storage migration replaces `workspace_sessions` with `sessions.workspace_id`.
Before changing the schema, startup writes and fsyncs the old link rows beside the
database. It selects the earliest link to a workspace in the session’s project,
ordered by creation time and ID, as the current workspace. Later links in that
project become session resource context and retain their existing details.
Cross-project links are kept only in the export. After restoration commits, the
original rows move to `<database>-migration-exports/workspace-sessions.jsonl`. This export
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

### Project extension configuration

`project_extensions` uses `(project_id, extension_ref)` as its primary key.
The project reference cascades on deletion; the extension reference points to a
local registration in `extensions` and prevents removing a source still in use.
Enabled state, configuration, diagnostics, display name and timestamps remain
on that project configuration. There is no separate stored instance ID or
polymorphic scope.

The instance collection and API responses keep their published fields. Their
ID is `project-extension:` followed by the JSON array `[project ID, source ID]`.
Changing a provider changes that ID. Activation deletes the old sync identity
before publishing the new one, and moves project settings and skill/automation
preferences in the same database transaction. A conflicting retained preference
aborts activation without replacing either choice. Stable extension-owned files,
documents and board views keep their owner.
Preference writes validate the live installation and save within one transaction,
so a concurrent switch or project deletion cannot leave an obsolete scope behind.

Before DDL, startup captures every released instance row. It maps project rows
and their dependent preferences to the new key, preserving values and timestamps.
All original rows remain in
`<database>-migration-exports/extension-instances.jsonl`, including non-project
or missing-project scopes that have no target in the project-only schema. The
original ID, scope and source reference in that export also identify the new
composite key. Exports remain until explicitly removed. Interrupted restoration
resumes from durable input; a different existing configuration causes a conflict
instead of overwriting either value.

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

### Legacy dependency markers

The interactive host opens restored journals immediately. Its quiet maintenance pass retires old local
`["ordered-dependency", operationId]` documents in batches. For an operation
without a settled or selected receipt epoch, it copies the marker’s epoch into
the journal. A journal selection already present takes precedence. Selectors
without a current operation row expire, as do missing or malformed selector
values. This can end legacy dependency lookup for an operation whose only
selection was in that marker. The upgrade preserves operation receipts and
pending saves. Each batch commits the selection and marker removal together.
Until its batch commits, a surviving marker can still resolve the operation’s
epoch. Interactive cleanup yields between batches and pauses when the workbench
is busy. Quiet maintenance also sweeps unreachable document files. Reopening
resumes from durable rows and files. Offline opens finish both passes before
returning.

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
