# Temporary runtime Planner write guards

Proposed: 2026-10-19

Status: Accepted. Temporary workaround replacing persisted timeline claims (ADR 0062) and launch claims (ADR 0070).

## Intended design

Planner edits should use atomic, revision-checked storage. Attempt launches should reserve capacity and publish the workspace, session, and attempt atomically.

## External limitation

The installed extension SDK cannot transact across these host operations, and Planner cannot access the host database. Persisting a claim does not create a transaction: a crash can strand the claim and block later writes.

## Temporary decision

1. Use runtime-owned guards scoped by project, extension, and operation key. Acquire synchronously before the first await and release synchronously in `finally`.
2. Keep the registry on a namespaced global symbol so reloaded extension handlers share ownership with earlier handlers. A crash destroys it; stored claims and manual recovery commands no longer participate.
3. Serialize timeline writes separately from attempt launches. Manual launches and Auto build share the launch guard and check capacity before creating a workspace. Auto build rechecks candidates before launching.
4. Preserve partial results: retry failed placement on the existing ticket; retain partial launch evidence and earlier successful launches.

## Limitations

- Guards serialize one runtime, whose host exclusively owns the local database. Cross-environment edits still need revision checks; this is not a distributed transaction.
- A slow or stuck handler retains its guard until it settles or the runtime stops. Timed expiry could overlap a live write and exceed capacity.
- Workspace and session creation remain separate operations requiring existing recovery behavior.

## Isolation

The guard stays in Planner's data layer. It adds no host or SDK API, database migration, timer, or stored ownership state.

## Removal

Replace guards when public storage and launch APIs enforce these atomic operations. Preserve concurrency, interrupted-write, capacity, and partial-result coverage.
