# Extension-owned data migrations

Proposed: 2026-10-16

Status: Accepted. Replaced the temporary template migration in [ADR 0015](0015-template-content-belongs-to-extensions-temporary-migration.md). Release 0.46 changed legacy retention under [ADR 0103](0103-database-baseline-replaces-in-place-upgrades.md).

## Decision

1. Core owns migration checkpoints and serialization. Extensions own data versions, domain mappings, transformations, and merge rules. Core never derives an extension owner from a domain record or installs extension code because of it.
2. `ctx.storage.migrate(version, run)` serializes an extension instance's scope. Pass the last successful integer version to the callback and advance only after success. Refuse downgrades from a newer stored version.
3. Failed callbacks may have written data and must support retry. Do not recursively enter migration on the same scope.
4. Persist successful versions in each owner's metadata document, separate from public custom storage scopes. Purging extension data or deleting an instance clears its versions. A no-op migration alone is not user content for pruning.
5. Run migrations at the extension's data entry points. Core readiness never waits for them. First-party and external extensions use the same public helpers.
6. Publish SDK preparation before extension adoption and removal of old bridges.

## Historical retention

- Originally, core retained opaque rows before table removal and exposed scoped, owner-restricted reads through `readLegacy`. Core did not interpret domain columns.
- Release 0.46 removed that archive, its private migration-prefix adapter, and the dedicated `extension_data_versions` table. `readLegacy` now resolves to `undefined`; `migrate` retains its behavior.
- The baseline/export decision owns recovery of pre-0.46 data. Do not treat the former 90-day archive process as a current storage path.
