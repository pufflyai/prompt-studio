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

Disable Spotlight indexing with `sudo mdutil -a -i off` on the disposable native
Intel macOS CI runner before dependency installation. Record indexing status.
[Control run 36184823777](https://github.com/pufflyai/prompt-studio/actions/runs/36184823777)
tests the exact unchanged signed application without profiling. All 19 original
cases pass in 232.7 seconds, with no retries or skips. Cold startup takes 5369 ms,
warm attachment 2164 ms, startup windows 695/812 ms, and recovery 90 ms. The prior
signed acceptance run failed cold/warm readiness at 19526/3732 ms. This supports
retaining the measured contention fix in the Intel jobs; it does not establish
Spotlight as the only possible source of slow startup. Application startup,
retries, performance budgets, and timeouts stay unchanged.

A fresh signed build in [run 36185150848](https://github.com/pufflyai/prompt-studio/actions/runs/36185150848)
still passes only 17 of 19 cases with indexing disabled. Its first launch spends
about 8.9 seconds before the first application initialization log, and cold
workbench readiness takes 10090 ms, above the unchanged 8000 ms limit. Warm
attachment takes 2580 ms and passes. The suite takes 327.7 seconds, about 41%
longer than the control. Signatures, notarization, Gatekeeper, and fuses pass;
release artifact preparation remains blocked. This confirms that removing
indexing contention alone does not establish Intel release readiness.

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
