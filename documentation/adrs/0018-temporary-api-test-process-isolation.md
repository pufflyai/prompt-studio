# Temporary API test process isolation

Proposed: 2026-09-07

Status: Accepted as a temporary workaround.

## Intended behavior

Each API test file owns its fixtures and releases them when it finishes. The test runner must release the file's module state, including closed PGlite instances, before loading more files. Extension imports must finish top-level asynchronous initialization before their exports are read.

## External limitation

Bun 1.3.14 keeps enough state across the full API suite to exceed 11 GiB and be killed by the operating system. Closing the twelve fixtures that discarded their app handle fixes those leaks but does not bound the full process. The low-memory runtime mode also keeps growing.

Bun's built-in `--isolate` completes the suite but still approaches 10 GiB. It also breaks the existing skill-service fixture's dynamic import with `Cannot access 'default' before initialization`. The same fixture imports correctly without that mode. Changing the fixture to avoid top-level await would hide a supported extension behavior.

The original reproduction logs were recorded in the local `workbench-sdk-revision` implementation report. That report is not part of the versioned documentation. These limits prevent using Bun's built-in file isolation for this suite today.

## Temporary workaround

Run each API test file in a fresh Bun process, with at most two files running at once. Retain the existing per-test timeout and normal import conditions. A file failure fails the whole command. This replaces the previous special invocation for the workspace-diff file.

Whole files with native deadline-sensitive work may use the existing `.exclusive.p*.test.ts` boundary: run the complete file alone after all shared workers finish. Exclusive files run sequentially. Keep every test body, workload and limit unchanged.

The web-icon routes fixture uses this boundary after a native Windows failure in the first real redirect/page/SVG lookup (run 42719629491, job 129510150452): it returns 404 after 5.543s under the existing 3-second production lookup limit. Independent import-closure review confirms the failing process executes zero PR-changed modules; the sibling's changed presence projection cannot execute in that scenario. This attributes the inherited operation to main source without claiming an exact-main branch red or identical whole-shard load. Exact-main full-shard and paired controls pass, and the original caught transport/abort error was not retained. Interference is therefore a hypothesis, not a diagnosed network fault. Classifying the complete 12-case fixture isolates its real-HTTP and subsecond assertions from unrelated database startup; fresh native qualification assesses that changed scheduling contract, not arbitrary-load product behavior. Remove its exclusive classification when the maintained native concurrent workload demonstrates the existing lookup/timing contracts without the measurement interference; do not increase limits or substitute mocked transport.

The driver is limited to the API package's test command. It adds process startup cost and interleaves two files' output. It does not change the API runtime, extension loading, installed packages, or test assertions. Fixtures must still close their resources explicitly.

## Update: native process deadline isolation (2026-11-06)

The established `.exclusive.p1.test.ts` scheduling rule also covers the process
host limits fixture. Its native Windows timeout check returned after 1,685 ms in
[production validation](https://github.com/pufflyai/prompt-studio/actions/runs/42149715856/job/127669792575),
185 ms above its unchanged 1,500 ms assertion. It previously shared the API's
two-worker pool with PGlite cold starts, unlike the other native process fixtures.
Run the complete file alone through the same scheduler; retain every command,
process-tree check, output limit, cancellation assertion, and timeout. This
isolates the timing measurement and does not establish contention as its only
cause. Fresh Windows execution must still demonstrate the existing limit.

## Update: private index publication isolation (2026-11-10)

The private device-index fixture also uses the existing `.exclusive.p1.test.ts`
boundary. Its two snapshot cases retain 1,000 sequential publications, fresh
readers, lost-acknowledgement recovery and their 30,000 ms whole-case allowance.
SQL and metadata reductions remove redundant work, but the shared Windows pool
still exceeds that allowance before completing publication.

A [standalone native Windows profile](https://github.com/pufflyai/prompt-studio/actions/runs/42726782890)
of the same optimized 1,000-publication loop completes in 24,493 ms. It spends
19,005 ms in transactions, including 16,240 ms inside their SQL callbacks, and
uses 29.1 CPU seconds. This supports isolating its deadline measurement from
another file's database work; it does not establish contention as the only cause.
Fresh execution of the complete fixture must still demonstrate the existing
limits. No workload, platform, assertion or execution allowance is removed.
The existing Linux quarantine entry follows the renamed file without changing
its case selection, evidence, owner or removal criteria.

## Removal

Remove the driver when the repository's Bun version releases completed file state within the current memory budget and passes the asynchronous skill-import regression with built-in isolation. Run the complete API suite and both release gates before removing it. Do not raise timeouts or alter the fixture's import semantics to satisfy that check.
