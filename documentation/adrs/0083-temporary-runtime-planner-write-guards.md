# Temporary runtime Planner write guards

Proposed: 2026-10-19

## Intended design

Planner edits should use atomic, revision-checked storage operations. Launching an attempt should reserve capacity and publish its workspace, session, and attempt as one operation.

## External limitation

The installed extension SDK does not offer a transaction spanning those host operations. Planner cannot access the host database. A durable lock record without a live owner does not solve this limitation: a crash can leave it blocking every later write.

## Temporary decision

Replace the persisted write claims from [ADR 0062](0062-temporary-timeline-write-claims.md) and [ADR 0070](0070-temporary-planner-launch-claims.md) with runtime-owned guards. The host executes extension commands, schedules, and hooks in the database owner's process. A guard is scoped by project, extension, and operation key. Acquire it synchronously before the first awaited operation and release it synchronously in `finally`.

Keep the guard registry on a namespaced global symbol so a reloaded extension shares guards with handlers from its previous source snapshot. Slow live writes retain ownership until they settle. A process crash destroys the registry; restarting cannot inherit a blocking lock. Existing stored write claims no longer participate in ownership, and the obsolete inspection and manual release commands are removed.

## Limitations

This guard serializes work only within one runtime. The host already owns exclusive access to its local database. Separate environments editing shared content still need revision-checked saves; a persisted Planner lock is not a distributed transaction. Partial workspace and session creation still needs the existing attempt recovery behavior. A handler that never settles keeps its guard until the runtime stops; an arbitrary expiry must not allow an overlapping live write.

## Isolation

The guard stays in Planner's data layer. No host or SDK changes, storage migrations, timers, or stored ownership records are needed.

## Removal

Replace the guard when public storage and launch APIs can enforce the relevant atomic operations. Preserve the concurrency and interrupted-write regression coverage when moving that responsibility to the host.
