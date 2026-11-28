# Temporary process isolation for macOS extension watches

Proposed: 2026-11-28

Status: Proposed

## External limitation

The packaged Bun 1.4.4 runtime shares its macOS FSEvents stream and lock across
JavaScript threads. A local nightly recorded a 31.9-second `watch.update`.
During a stalled quit, a process sample showed the FSEvents thread waiting in
`FSEventStreamStart` while the runtime main thread waited on an unfair lock.
Moving extension watches to a worker thread still shares the native lock.

## Decision

On macOS, run extension source and discovery watches in a dedicated child
process. Keep watch registration, attachment validation and change detection
together. The API retains extension discovery writes, preparation and view
publication. The API terminates the watch process on shutdown. The child owns
no database or staged installs, and the OS releases its handles on exit.

The child can still be slow to attach. Accepted extensions and foreground
preparation can proceed while it waits. The extension readiness diagnostic
continues to include actual watch registration.

## Removal

Revisit process isolation when the supported Bun macOS adapter can register and
retire watches without blocking other threads. Compare packaged macOS launch,
first tool use, quit and immediate reopen with several installed extensions.
