# Sessions and ticket subnavigation benchmark

Benchmarked: 2026-10-19 and 2026-10-20. Application version: 0.44.0 with local changes.

The performance contract is **structure below 100 ms** and **complete subnavigation within 500 ms of the click**. Both limits apply to every sample. A fast median does not excuse a slow tail.

## Run

From the repository root:

```sh
bun run --cwd packages/e2e perf:subnav
```

The benchmark builds the host binary using the existing packaged-test helper, installs the real local Planner extension, and launches Chromium against the compiled dashboard and API. Provision full Chromium with `pst extensions install-browser` first if it is not installed. The benchmark creates its own persistent test home under `work/subnav-benchmark/`; it does not open the user's database. All fixture changes use public commands or HTTP APIs.

The default run uses 30 fresh browser contexts. Each context measures Sessions and a ticket twice, yielding 30 first visits and 30 repeat visits per destination, 120 clicks in total. The first destination visit has no destination warmup. Repeat visits use browser history in the same context. Initial project setup, authentication, fixture creation, and extension installation are outside the timed interval. The application is already running: this is a navigation benchmark, not a process-startup benchmark.

Useful environment variables:

| Variable | Meaning |
| --- | --- |
| `SUBNAV_SAMPLES` | Number of fresh contexts; defaults to 30. Small diagnostic runs are pilots. |
| `SUBNAV_LABEL` | Result folder name; defaults to `current`. |
| `E2E_PACKAGED_BINARY_PATH` | Use an already compiled binary instead of rebuilding. |
| `SUBNAV_PLANNER_SOURCE` | Install a separately prepared Planner source with a matching standalone lockfile, for controlled comparisons. |
| `SUBNAV_OFFLINE=1` | Generate the fixture lockfile from the Bun cache. Requires dependencies already cached. |
| `SUBNAV_TRACE=1` | Record the first context for diagnosis. Keep tracing off for reported timing runs. |
| `PLAYWRIGHT_BROWSERS_PATH` | Location of provisioned full Chromium, when outside Playwright's default cache. |

The script writes `results.json` and a ticket screenshot under `work/subnav-benchmark/results/<label>/`. Results contain individual samples, median, nearest-rank p95, maximum, budget-miss counts, relevant request timings and outcomes, mounted row counts, browser version, CPU, binary hash, and page errors. It exits with status 1 on any budget miss or captured error.

## Fixed workload

- A real Git repository containing 15,000 TypeScript source files and an ignore file. Each source file has 128 lines.
- 1,000 Planner tickets with about 4 KB of instructions each. The unfiltered ticket board retains every ticket; its sort places the measured ticket in the visible area.
- 1,000 completed sessions created through the session API. A fixture harness completes without invoking an external agent.
- Five real Git worktrees linked to the measured ticket. Each has 20 sessions; another 20 sessions directly reference the ticket from the project workspace. The ticket must return all 120 relevant sessions, including both sources.
- A 1440 × 900 viewport, full Chromium in headless mode, no CPU or network throttling, and no injected response delays.

This workload uses clean local worktrees and completed sessions.

The session-list check uses End after each timed measurement to verify that the oldest session remains reachable. Virtualization may reduce mounted rows; it must retain the complete logical list. Ticket requests must succeed and return all 120 relevant sessions.

## Measurement

The page clock starts in a capture-phase listener on the actual click event, excluding Playwright's actionability wait.

Structure means the real destination section labels are visible. Sessions requires its section heading, excluding the root navigation row. The ticket requires its title and Files, Workspaces, and Sessions headings. The clock records a conservative rendering opportunity after two animation frames following detection; this is not a GPU presentation timestamp.

Complete subnavigation is the latest of that structure timestamp, the last sidenav DOM update followed by two animation frames, and the last relevant request completion. Relevant requests are tree command reads and workspace diff-summary reads. The recorder retains HTTP status, command outcome, request duration, and completion time measured from the click. These are browser-observed timings, not isolated server execution times.

A 200 ms quiet interval confirms that requests and DOM changes settled. The quiet interval is excluded from latency. A separate 10-second request measurement allowance lets a failed budget produce evidence; it does not change the 500 ms product limit. Destination-loading and assertion failures remain failures.

First-visit results include ordinary browser module loading and page rendering caused by navigation. Requests and rendering for the main page can contend with subnavigation on the same browser thread. The benchmark keeps that contention because the user experiences it.

## Structure-first build (2026-10-20)

The host now renders declared section structure synchronously before starting content reads after the React commit. Pending sections show a spinner; actual results replace them. Extension view metadata can supply section IDs, labels, and the bound resource row without a callback. Core contributions use the same synchronous path.

Loaded renderer contents use React transitions so navigation and input retain priority. Main, Side, and Bottom contents mount after a browser paint opportunity; already-mounted views retain their identity and draft state. Empty tree-move state no longer triggers another render just because the navigation scope changed.

Planner board rows now include page targets computed from their already-loaded review state. Clicking an existing row navigates locally without another command to choose its destination. Rows with pending review input target the requests page. Activation callbacks remain the fallback, including for newly created rows.

This run uses the same fixed workload, unchanged clock and budgets, 30 fresh contexts, 120 clicks, and Chromium version as the previous optimized run. No builds, tests, or profiling ran during timing samples. Raw results use label `structure-first-30`; measured binary SHA-256: `75113ff0cb6a13e93053a218686e68fdd18b287543c34b957870960332d5672a`. These changes are local and are not in the released 0.44 build.

These timing results precede the ticket/workspace continuity correction. The latest tree read identity follows the navigation owner's bound resource. Selecting a child workspace refreshes that owner's data while retaining its mounted rows; selecting another ticket starts with the new ticket's declared structure. The packaged workspace-selection regression and seven browser stories passed after this correction. The interactive test instance uses that corrected build; its latency has not been remeasured.

| Navigation | Structure median / p95 / max | Complete median / p95 / max | Structure misses | Completion misses |
| --- | ---: | ---: | ---: | ---: |
| Sessions, first | 88 / 107 / 117 | 380 / 456 / 476 | 3/30 | 0/30 |
| Sessions, repeat | 120 / 136 / 192 | 322 / 353 / 403 | 28/30 | 0/30 |
| Ticket, first | 147 / 218 / 292 | 834 / 1009 / 1023 | 30/30 | 30/30 |
| Ticket, repeat | 176 / 222 / 431 | 695 / 824 / 829 | 30/30 | 30/30 |

**The strict performance gate still fails.** There are 91 structure misses and 60 completion misses. Sessions completes within 500 ms on all 60 visits; ticket completion exceeds 500 ms on all 60. Every ticket read returned all 120 related sessions. The oldest session remains reachable. There were no page errors or failed requests. Mounted option-row counts remain 32 for Sessions and 29 for tickets.

Compared with the previous optimized build, first-visit structure medians improve from 436 to 88 ms for Sessions and from 777 to 147 ms for tickets. Repeat medians improve from 450 to 120 ms and from 598 to 176 ms. Sessions completion improves, but ticket completion regresses from 810 to 834 ms on first visits and from 626 to 695 ms on repeat visits. A faster initial layout does not establish compliance with either tail-latency contract.

Ticket HTTP request duration is 424 / 510 / 548 ms on first visits and 290 / 440 / 455 ms on repeats. Completion from the click is 548 / 654 / 732 ms and 437 / 632 / 665 ms. The paired median request start is 121 ms after the first click and 145 ms on repeats. After response completion, the paired median remaining visible completion cost is 282 ms and 237 ms. Request dispatch, server work, and browser rendering all still need improvement.

A three-context recheck of the previous optimized binary on the same fixture gave first-visit structure medians of 475 ms for Sessions and 743 ms for tickets, consistent with that build's earlier full run. This pilot is diagnostic and does not replace the 30-context comparison.

Latest functional verification after the continuity correction: workbench type checking, seven browser stories, the packaged workspace-selection regression, public type exports, package consumers, and all 92 packaged CLI/runtime tests passed. The full package check remains unsuccessful: 10 browser checks passed, four were skipped for unavailable Firefox/WebKit, two Planner setups failed on a registry HTTP 503 for `@types/trusted-types`, and the Chromium webview check lost the retained Bottom terminal tab after browser Back in `packaged-mode-panel-state.ts`. The compiled Bun CLI smoke step did not run because the browser phase failed. These failures still need resolution; they do not change the performance budgets.

## Previous optimized build (2026-10-19)

Measured with Chromium 148.0.7778.96 on Linux x64, AMD EPYC 9V74, a four-CPU quota, and a 16 GiB memory limit. The browser used its normal CPU speed. No builds, tests, or profiling ran during timing samples.

Each row has 30 samples. Times are milliseconds, rounded to the nearest millisecond.

| Navigation | Structure median / p95 / max | Complete median / p95 / max | Structure misses | Completion misses |
| --- | ---: | ---: | ---: | ---: |
| Sessions, first | 436 / 512 / 556 | 465 / 520 / 565 | 30/30 | 3/30 |
| Sessions, repeat | 450 / 504 / 582 | 474 / 532 / 584 | 30/30 | 5/30 |
| Ticket, first | 777 / 942 / 948 | 810 / 969 / 1,008 | 30/30 | 30/30 |
| Ticket, repeat | 598 / 719 / 721 | 626 / 739 / 743 | 30/30 | 30/30 |

**This build fails the contract.** All 120 structure measurements exceed 100 ms; 68 completion measurements exceed 500 ms. There were no page errors, failed navigation requests, or missing ticket history. Sessions mounted 32 total option rows at the measured viewport instead of mounting the entire list.

First-visit ticket requests took 407 ms median, 497 ms p95, and 524 ms maximum. Their completion measured from the click was 551 / 664 / 684 ms. Repeat request durations were 276 / 323 / 325 ms, and their completion from the click was 426 / 485 / 494 ms. Request latency alone does not explain the visible completion time: browser processing and rendering continue afterward. Sessions required no new tree HTTP request during the measured interval; its project session data was already available from normal project loading.

For each ticket sample, subtracting request completion from visible completion leaves a median 255 ms on first visits and 212 ms on repeat visits. These are paired measurements from each click, not differences between independently selected percentile values.

The ticket tree request itself starts a median 149 ms after the first click and 150 ms on repeat visits. Structure currently waits for that response, so faster server queries alone cannot satisfy the 100 ms structure budget on this path.

The raw current-build results use label `final-30`. These numbers describe the locally compiled changes, not an update already present in an installed 0.44 release.

## Earlier-build control

The control uses label `earlier-fixes-30`. Its preserved binary includes the earlier progressive navigation and nonblocking session-launch changes. It predates sortable virtualization and deferred row menus. Planner uses its previous ticket tree callback, which reads all project session history. This is a comparison with the earlier local fixes, not with an untouched released 0.44 binary.

Both builds use the same persistent fixture, browser settings, latency measurement code, and sample count. Each has 30 first and 30 repeat visits per destination. The current run preceded the control run. Neither timing run enabled tracing or CPU profiling. Binary hashes are recorded in the raw results.

| Navigation | Earlier structure median / p95 / max | Earlier complete median / p95 / max |
| --- | ---: | ---: |
| Sessions, first | 7,428 / 8,042 / 8,146 | 7,529 / 8,147 / 8,258 |
| Sessions, repeat | 6,321 / 6,938 / 7,118 | 6,401 / 7,029 / 7,208 |
| Ticket, first | 1,248 / 1,418 / 1,595 | 1,391 / 1,568 / 1,623 |
| Ticket, repeat | 1,006 / 1,209 / 1,225 | 1,034 / 1,237 / 1,260 |

All 120 control samples missed both budgets. The current changes reduce first-visit structure medians by 94.1% for Sessions and 37.7% for the ticket; repeat-visit reductions are 92.9% and 40.5%. The control mounted 1,003 total option rows for Sessions and 130 for the ticket; the current build mounted 32 and 29 respectively. Neither run had page errors, failed navigation requests, or missing ticket history.

## Confirmed costs and changes

The original sortable tree bypassed virtualization. On this workload it mounted all 1,000 session rows and their drag and menu components. The shared tree now mounts the visible range while retaining sorting, row and section dragging, and keyboard navigation.

The workbench adapter also constructed menus for every logical row. A regression check counted 3,001 shortcut-list evaluations while adapting 1,000 rows with resource menus and no row actions. Empty action lists now return immediately, and resource menus resolve when their row requests them. The check now observes zero shortcut-list evaluations during adaptation and one for the requested row menu. Menu results remain shared between overflow and right-click access for that adapted row.

Planner previously paged through all project session history when opening one ticket. It now queries the ticket anchor and linked workspace histories, and performs independent metadata reads in parallel. The benchmark verifies the resulting union contains all 120 sessions.

These changes reduce work, but do not by themselves establish compliance with the budgets. The remaining browser profile includes route/page rendering, session widgets, editor modules, layout, and scroll measurement. Before the structure-first change above, ticket section structure came from the asynchronous tree callback and could not appear before that response.

The local npm registry returned HTTP 503 during setup. Dependencies were already available in Bun's cache, so fixture preparation used offline lockfile generation and a populated isolated extension cache. This setup work is outside the timed interval. TLS validation remained enabled.

## Previous validation

- 19 workbench tree adapter/action tests and seven Planner ticket-file/history tests passed.
- UI, workbench, Planner, and the standalone benchmark type checks passed. Changed TypeScript files passed Biome; changeset validation passed.
- Playwright checked virtualization, row activation, Home/End navigation, row dragging, section dragging, existing sortable behavior, and dragging across a virtualized scroll range.
- Linux package verification passed: 92 CLI/runtime tests, 13 browser tests, published type exports, package consumers, and the compiled Bun CLI smoke check. Four Firefox/WebKit browser checks were skipped because those browsers were unavailable.
- A missing-browser failure was checked separately: the benchmark exits and closes its isolated runtime.

The performance gate failed on both measured builds. Functional validation does not waive its 100 ms / 500 ms limits.
