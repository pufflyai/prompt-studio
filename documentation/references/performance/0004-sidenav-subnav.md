# Sessions and ticket subnavigation benchmark

Benchmarked: 2026-10-21.

The performance contract is **structure below 100 ms**, **complete subnavigation within 500 ms of the click**, and **editable ticket content below 500 ms**. Each limit applies to every sample. A fast median does not excuse a slow tail.

## Run

From the repository root:

```sh
bun run --cwd packages/e2e perf:subnav
```

The benchmark builds the host binary using the existing packaged-test helper, installs the real local Planner extension, and launches Chromium against the compiled dashboard and API. Provision full Chromium with `pst extensions install-browser` first if it is not installed. The benchmark creates its own persistent test home under `__test-tmp__/subnav-benchmark/`; it does not open the user's database. All fixture changes use public commands or HTTP APIs.

The default run uses 30 fresh browser contexts. Each context starts on the ticket board and measures a ticket before Sessions, then repeats both destinations. This yields 30 first visits and 30 repeat visits per destination, 120 clicks in total. Opening the ticket first prevents Sessions from downloading shared editor modules before its timed click. Repeat visits use browser history in the same context. Initial project setup, authentication, fixture creation, and extension installation are outside the timed interval. The application is already running: this is a navigation benchmark, not a process-startup benchmark.

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

The script writes `results.json` and a ticket screenshot under `__test-tmp__/subnav-benchmark/results/<label>/`. Results contain individual samples, median, nearest-rank p95, maximum, budget-miss counts, relevant request timings and outcomes, mounted row counts, browser version, CPU, binary hash, and page errors. It exits with status 1 on any budget miss or captured error.

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

Ticket editor readiness is measured separately. The requested ticket's heading must be visible inside the editable Main document. It is checked again after two animation frames. First visits include downloading editor modules and loading the ticket document; no ticket editor is opened before the timed click. This measure excludes cold browser startup and the initial project sync, which require separate measurements.

Ticket document reads use the resource ID directly. Resource resolution reads only the requested tickets and their ancestors. Native file controllers mount immediately and start their reads; the shared lazy Markdown editor loads its own implementation. Independent ticket sidebar reads run together. A retained board keeps its last committed page parameters while another page is active, so opening a ticket does not reload the hidden board's entire ticket list. Resource and asset timings in the result identify work that still delays the editor.

A 200 ms quiet interval confirms that requests and DOM changes settled. The quiet interval is excluded from latency. A separate 10-second request measurement allowance lets a failed budget produce evidence; it does not change the 500 ms product limit. Destination-loading and assertion failures remain failures.

First-visit results include ordinary browser module loading and page rendering caused by navigation. Requests and rendering for the main page can contend with subnavigation on the same browser thread. The benchmark keeps that contention because the user experiences it.

## Results (2026-10-20)

Both builds ran back to back on the same machine, fixture, browser, and benchmark code: macOS arm64, Apple M5 with 10 CPUs, 32 GiB memory, and Chromium 148.0.7778.96. The main build is commit `51d544998` with this benchmark copied in unchanged. Each row has 30 samples. Times are milliseconds as median / p95 / max.

| Navigation | Structure, main | Structure, this change | Complete, main | Complete, this change |
| --- | ---: | ---: | ---: | ---: |
| Sessions, first | 727 / 815 / 850 | 52 / 60 / 64 | 764 / 857 / 889 | 151 / 171 / 171 |
| Sessions, repeat | 675 / 697 / 715 | 37 / 45 / 45 | 691 / 726 / 742 | 99 / 121 / 123 |
| Ticket, first | 622 / 1,013 / 1,215 | 429 / 725 / 930 | 674 / 1,173 / 1,334 | 473 / 788 / 980 |
| Ticket, repeat | 485 / 697 / 759 | 378 / 567 / 824 | 658 / 790 / 815 | 435 / 699 / 1,071 |

Sessions now meets both budgets on all 60 visits; main missed both on every visit. The ticket still misses the structure budget on all 60 visits and the completion budget on 25. Its section structure comes from the Planner tree callback, so it cannot appear before that response until Planner declares `structure`. Neither build had page errors or failed requests, and every ticket read returned all 120 related sessions. Mounted option rows fall from 1,003 to 32 for Sessions and from 130 to 29 for the ticket.

## Ticket editor results (2026-10-21)

The `ticket-loading-final-cold` run uses the same fixed workload and machine described above, with the ticket opened before Sessions in each fresh context. Each row has 30 samples. Times are milliseconds.

| Visit | Editable content median | p95 | Maximum | Samples at or above 500 ms |
| --- | ---: | ---: | ---: | ---: |
| First | 380 | 954 | 1,145 | 8/30 |
| Repeat | 61 | 92 | 99 | 0/30 |

This improves typical ticket opening time but does not meet the 500 ms limit in every sample. Ticket sidebar structure misses its 100 ms limit on all 60 visits; complete sidebar data misses 500 ms on 17 first visits and 9 repeat visits. All requests succeed and return all 120 related sessions. These results exclude cold dashboard startup.

## What each change contributes

The following variants were measured on 2026-10-20. Each removed one change from that build and reran the full 30-context benchmark.

| Variant | Sessions structure, first / repeat median | Sessions complete, first / repeat median | Ticket complete, first / repeat median | Ticket completion misses |
| --- | ---: | ---: | ---: | ---: |
| This change | 52 / 37 | 151 / 99 | 473 / 435 | 25/60 |
| Row menus built for every row | 70 / 52 | 185 / 135 | 478 / 442 | 18/60 |
| Panels mount without waiting for a paint | 57 / 36 | 158 / 98 | 550 / 678 | 44/60 |

The sortable tree previously skipped virtualization, so Sessions mounted all 1,000 rows with their drag and menu components. The shared tree now mounts only the visible range and keeps sorting, row and section dragging, and keyboard navigation.

The workbench adapter builds a tree row for every logical row. Building each row's menu resolves commands, context, and shortcuts, which adds 15 to 18 ms to the Sessions structure median on this workload. Menus are now built when a mounted row first reads them.

Main, Side, and Bottom panel contents mount after the browser paints the navigation, except native file controllers, which start asynchronous document reads immediately. In the 2026-10-20 comparison, mounting every panel immediately raised ticket completion medians by 77 ms on first visits and 243 ms on repeat visits, and completion misses almost doubled. Sessions did not change because its page mounted no new panels.

Declared structure renders before contents for core navigation and for extension views that set `structure`. Loaded contents use React transitions, so navigation and input keep priority.
