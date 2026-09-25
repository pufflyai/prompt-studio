# Temporary macOS desktop CI indexing isolation

## Intended design

Native desktop checks should measure the packaged application's startup on an
idle, prepared runner. The runner image should finish its own setup before the
job starts. Product startup limits remain unchanged.

## External limitation

GitHub's `macos-15-intel` runner indexes files while native tests run. In
[diagnostic run 36184062396](https://github.com/pufflyai/prompt-studio/actions/runs/36184062396),
Spotlight's `mdworker_shared`, `mds_stores`, and `mds` consumed at least 86.5 CPU
seconds during about 114 wall seconds on a four-CPU machine. They also ran during
the failed warm launch. System load started at 9.78. Profiling itself adds load,
so its timings are diagnostic evidence, not release acceptance.

The repository does not control the hosted image. A product change cannot stop
an unrelated indexing job, and disabling search on users' machines would be
wrong. Indexing is a measured source of contention; it is not yet proven to
explain every Intel failure.

## Temporary workaround

Test disabling Spotlight indexing with `sudo mdutil -a -i off` on the disposable
native macOS CI runner before dependency installation. Record indexing status.
Compare the unchanged signed application and unchanged packaged suite against
the original failure. Retain this CI setup only if the native evidence supports
it. Do not change application startup, retries, performance budgets, or timeouts.

This is a temporary runner workaround, not the intended product design. It
removes Spotlight contention from CI and does not prove startup performance
while a user's machine is busy indexing. Manual checks still use normal OS
settings. The command must stay in hosted CI workflows; do not add it to local
validation, packaging, installation, or application startup.

## Removal

Remove the setup when the hosted image provides a quiet indexing state before
jobs start, or a dedicated native runner provides that isolation. Verify the
unchanged full packaged suite and its original performance limits, and retain
system-load evidence when removing it.
