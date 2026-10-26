# Temporary parallel core fixture removal

Proposed: 2026-10-26

## Status

Proposed. Adoption requires the complete cold core cases to pass on Windows x64 and ARM64 within their unchanged 120-second allowance.

## Intended design

The core fixture stops its runtime and registry, then awaits removal of every file it owns. The standard recursive filesystem operation should complete this teardown as part of the existing cold test workload. Links to dependencies outside the fixture must never remove their targets. Filesystem errors must remain visible.

## External limitation

The fixture runs on Bun 1.4.4. In native [run 40253697702](https://github.com/pufflyai/prompt-studio/actions/runs/40253697702), awaited recursive removal took about 83 seconds on x64 and 54 seconds on ARM64. The complete tests failed their existing allowance. An [actual x64 inventory](https://github.com/pufflyai/prompt-studio/actions/runs/40262529282/job/121377772357) found about 83,000 files, 7,000 directories and 1,462 links; inventory itself took 490 ms.

This does not prove a generic Bun defect. A [separate comparison](https://github.com/pufflyai/prompt-studio/actions/runs/40261584175) removed equivalent, simpler 30,000-file trees in roughly 3–6 seconds with Bun, Node and native commands. The actual topology and implementation costs still need attribution. A three-level parallel experiment reduced x64 removal to 25 seconds, but its whole fixture still failed at 133 seconds.

The standard recursive operation's traversal and scheduling belong to the runtime. Its caller cannot select concurrency within that operation. This repository cannot change that implementation. Removing fewer files, leaving deletion running after the test, or raising its allowance would break the accepted workload and ownership rules. No replacement is accepted merely because its deletion phase is faster.

## Proposed temporary workaround

Test a local traversal that removes independent entries concurrently, then removes each directory after its children finish. Read directory-entry types once. Unlink links themselves, including a linked root, without following targets. Await all sibling operations before reporting errors. Preserve missing-path handling and propagate unexpected failures. Add no retries, external commands or timeout changes.

The candidate stays isolated to the packaged core fixture's cleanup helper. It changes no product behavior, persisted data or public API. Eager scheduling uses more promises and queued filesystem operations than a single recursive call; native qualification must check complete elapsed time and resource behavior.

The candidate is not yet proven necessary or sufficient. If it cannot satisfy the complete native workload, discard it and continue profiling setup and teardown instead of treating it as the intended design.

## Removal

Replace the helper with the standard recursive operation when the same complete cold core cases, including shutdown and file removal, pass within 120 seconds on both Windows architectures. Compare the actual fixture topology and retain external-link ownership checks. Do not use the simpler synthetic tree as the removal gate.

## Bounded follow-up after job-temp placement

The original eager traversal above was rejected and never shipped. Keep this record's number and original proposal date. ADR 0114 configures the provider-owned job temp directory. That lets all x64 packaged cases pass through the normal workflow, but full native run 40288189449 still fails both ARM64 core cases: all features finish at 93.3 seconds, and standard awaited removal completes at 122.8 seconds; defaults complete at 120.6 seconds. The fixed 120-second allowance remains.

The follow-up candidate first inventories the owned tree without following links. It removes files and links with at most 64 filesystem operations in flight, then removes directories in depth order, waiting for each complete depth before its parent. Every submitted operation settles before an error is returned. This bounds scheduling and preserves directory and external-target ownership. It adds no deletion process, retry, platform flag or timeout change. Inventory and worklists cost memory; full native verification must establish that the trade-off is useful.

This remains a diagnostic candidate. Native qualification uses the existing complete cold cases as the regression, plus real nested-tree, junction, hardlink and missing-root ownership cases. No timing-only synthetic assertion substitutes for the original complete workload. If both full native suites do not pass, do not adopt it.
