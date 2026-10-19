# Temporary Planner launch claims

Proposed: 2026-10-11

Superseded by [ADR 0083: Temporary runtime Planner write guards](0083-temporary-runtime-planner-write-guards.md). The `attempt-launch` key now uses a runtime-owned guard. The persisted claims and manual recovery described below are historical.

## Intended design

Planner should reserve implementation capacity and create an attempt atomically. Manual starts and Auto build should share that reservation, so neither can exceed project capacity or duplicate an automatic selection.

## External limitation

Public extension storage provides atomic collection claims but no transaction across extension storage, workspace creation, and session creation. Planner cannot access the host database. A storage transaction alone cannot include these host operations, so a clean atomic launch is currently impossible.

## Temporary workaround

Reuse the owner claim guard from [ADR 0062](0062-temporary-timeline-write-claims.md) with the project-scoped key `attempt-launch`. Manual starts hold it for one launch. Auto build holds it while selecting and launching a batch. All launch paths check capacity before creating the workspace.

Claims have no timed expiry. An expiry could allow another writer to exceed capacity while a slow launch still runs. Release only the exact owner token on success or failure.

## Limitations

Concurrent launch requests must retry after the current writer finishes. A host crash can leave a claim behind. Stop the old writer before using the existing claim inspection and conditional release commands.

Workspace and session creation remain separate operations. A launch failure can leave a workspace for inspection; Auto build reports the failure and preserves earlier successful launches. Ticket edits and human requests remain independent, so Auto build rechecks each candidate before launching.

## Isolation

The guard stays in Planner's data layer and uses the existing `timeline.write-claims` collection and recovery commands. The shared attempt launcher owns actual attempts. No host, SDK, or database schema changes are needed.

## Removal

Replace the guard when the public host API supports durable capacity reservations covering workspace, session, and attempt publication. Remove the launch claim in the same release and clear abandoned launch claims. Keep partial-launch evidence until the new API makes launch completion or cleanup atomic.
