# Temporary: repair the existing entry in the bundle retry test

Proposed: 2026-10-14

## Intended behavior

A failed extension build must release its pending promise. After the author repairs the source, another call for the same entry and output path must run a new build and produce a complete bundle.

Ideally, repairing the source includes adding a missing dependency. The build must see files written before its call, even while other builds are running.

## External limitation

Bun 1.4.2 can reuse a directory listing across builds in the same queue batch. Its resolver generation advances after the queue drains, rather than before each build. A dependency added after a failed build can therefore remain invisible to the next build.

The PS-700 parent coverage job failed this case in run [38546797930](https://github.com/pufflyai/prompt-studio/actions/runs/38546797930/job/115794732375). A standalone Linux reproduction using a parked build queue also failed to resolve the newly added file. Repairing the entry to import an existing dependency succeeded with the same queue arrangement.

[Upstream Bun PR 38212](https://github.com/oven-sh/bun/pull/38212) describes this defect and proposes advancing the generation before every build. It is open as of the proposal date. A clean fix belongs in Bun's resolver; this project cannot change that internal generation through the public build API.

## Temporary decision

Precreate the valid dependency in the retry test. Let the first real build fail on a missing import, then repair the same entry to import the existing dependency. Keep the second real build, the same output path, and the bundled content assertions.

This fixture isolates Prompt Studio's failed-build cleanup rule. It does not fix or validate recovery by adding a new directory entry. Keep the unresolved-dependency reporting test and record the added-file recovery gap in PS-732.

Do not add sleeps, retries, cache flushing, skipped assertions, or production resolver workarounds. Do not change test time limits.

## Limitations

The retry test temporarily does not cover adding a previously missing dependency to the directory. That scenario still depends on the upstream fix. The change affects only the test fixture; production bundling remains unchanged.

## Removal

When the repository's supported Bun release includes the upstream generation fix, restore the fixture that creates the missing dependency after the first failed build. Confirm that the real extension package tests and Linux coverage pass, including overlapping builds. Remove this temporary decision or mark it superseded with that validation evidence.
