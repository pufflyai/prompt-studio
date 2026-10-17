# Temporary legacy database lock fence

Proposed: 2026-10-17

## Intended ownership

One SQLite transaction owns the right to open a PGlite home. The operating system releases that lease after process death, including across container PID namespaces. No second PID-based owner should decide whether a database is safe to open.

## External limitation

Already released runtimes use filesystem bakery claims under `pstdio.db.lock`. They cannot see SQLite's lease and can remove another container's PID claim as stale. Updating the new runtime cannot repair an older executable's lock implementation. A normal owner JSON marker is therefore insufficient.

## Temporary decision

Before opening PGlite, the SQLite lease holder publishes an empty reserved directory named `sqlite-format.active` inside the legacy claim directory. The old runtime cannot parse that directory as JSON or remove it with its stale-claim `unlink` operation, so it refuses to open the database. The new owner checks for every other legacy claim after publishing this fence. An already running or competing old runtime makes the new attempt fail until that runtime stops.

SQLite remains the only live lease. The fence is a permanent format marker for that home and survives release and process death. A new runtime recognizes only that exact empty directory; it never removes or interprets arbitrary legacy claims as stale. The fence does not contain credentials or a PID.

## Limitations

Opening a home with the new runtime upgrades its lock format in one direction. Older executables cannot reopen that home, even when no new runtime is active. This deliberately avoids unsafe downgrade writes. The workaround is isolated to database lock acquisition and compatibility fixtures. It neither changes product data nor adds a second ownership record.

## Removal

Remove the compatibility publishing/checking code when all supported runtimes use the OS lease and older executables no longer share current homes. Keep existing fences on disk until downgrade access is explicitly retired; do not remove them as ordinary lock cleanup. Mixed-version, simultaneous-start and crash/restart tests must remain until that removal.
