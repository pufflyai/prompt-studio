# Tickets with linked resources

The `planner` benchmark suite includes a board with **200 tickets**, each linked to a
real Git workspace, a synthetic GitHub pull request, and a synthetic CI build. The
600 links include both directions. Custom resources belong to an installed fixture
extension using the public resource-kind resolver and page-navigation contracts.
No GitHub account or network requests are needed.

## Run the end-to-end benchmark

Build the current host assets, then run:

```sh
bun run build -- --scope pstdio-dashboard --scope pstdio-api --include-dependencies
BENCHMARK_SAMPLES=1 bun run --cwd packages/e2e perf:planner-linked-resources
```

Without `BENCHMARK_SAMPLES`, the standalone runner measures three samples. The
benchmark runner controls its own sample count. Pass `--home <directory>` to keep
and reuse the seeded board; use a fresh directory after changing the fixture or
extension code. Planner installs against locally packed SDK and UI packages, so
unpublished APIs can be exercised without changing release dependency pins.

Each sample restarts the compiled runtime and opens a fresh Chromium browser at
4x CPU throttle (`CPU_THROTTLE` overrides that rate). The first navigation redeems a
normal browser login link and opens Tickets. Readiness means the first visible card
has all three actionable badges, rather than only its title. The existing Planner
cold-open ceiling remains 3,000 ms. Seeding and extension installation are untimed.

The test also verifies all 200 returned rows have exactly their expected resources,
scrolls the virtual board until all 200 cards and 600 badges have been checked, and
opens a PR and a workspace from their badges. It records query duration, response
bytes, scrolling duration, retained browser heap, and browser long tasks. Those
diagnostic measurements have no new timing ceilings. Screenshots and `results.json`
are saved under the printed `__test-tmp__/planner-linked-resources/<run>` directory.
`BENCHMARK_RESULTS` receives the standard benchmark measurements when set.

The first local macOS arm64 sample on 2026-11-03 verified all 200 cards and 600
badges, plus PR and workspace navigation. It measured 3,713 ms to badges ready,
397 ms for the subsequent board query, 672 kB of projection JSON, 2,306 ms to scroll
and check every card, and 46.8 MB of retained browser heap. The cold-open check
**failed** its unchanged 3,000 ms ceiling. These local observations do not establish
a hosted baseline or approve a larger budget. The older 1,000-ticket first-card
benchmark is unthrottled and has a different readiness boundary; these numbers
alone cannot establish a regression against it.

## Inspect the board in the isolated app

```sh
bun packages/e2e/src/perf/planner-linked-resources.diagnostic.ts
```

The launcher builds current host assets, prepares local SDK/UI packages and starts a fresh `dev:playwright`
Docker stack with Planner and the Codex harness. Stop any previous `dev:playwright`
stack first. Open the printed Board URL, which includes a single-use browser login.
Select the **200 linked tickets** view if it is not
already selected. Each ticket has workspace, PR and build badges. The PR and build
pages are synthetic destinations; this fixture does not implement the GitHub
integration. The seeder refuses a board that already contains tickets.

After inspection, stop the disposable stack and remove its state:

```sh
bun run dev:playwright:down
```
