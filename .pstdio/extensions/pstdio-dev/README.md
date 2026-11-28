# Prompt Studio Dev extension

This repository-local extension prepares Prompt Studio worktrees, controls isolated development stacks, discovers high-impact issues, and tracks benchmark performance.

## CLI commands

```sh
pst pstdio-dev workspace open-in-vscode --workspace-id <id>
pst pstdio-dev workspace open-in-isolation --workspace-id <id>
pst pstdio-dev workspace stop-isolation --workspace-id <id>
```

`open-in-vscode` opens the workspace worktree in VS Code. `open-in-isolation` starts the repository's isolated development stack and opens its dashboard. `stop-isolation` stops that stack.

Workspace creation does not install dependencies or start a build. Run targeted setup and validation explicitly with the repository’s `bun run test:review` command.

## Agent automations

Daily high-impact issue discovery, merge queue repair and release dry run repair are off by default. To opt in, open the **Automations** dropdown for **Prompt Studio Dev** in the project's **Extensions** settings and enable the schedules you want.

When enabled, **Daily high-impact issue discovery** starts a search at noon and creates a Planner ticket only when it reproduces a high-impact issue that has yet to be tracked.

## Performance

Expand **Performance** in the project navigation to open **Trends**, **Compare**, or **Runs**. Each destination keeps the project navigation visible. **Trends** shows every benchmark across releases, one line per platform. **Compare** compares two commits, or shows one commit's own results, and measures commits that have none. **Runs** lists benchmark runs on GitHub Actions. Its native **New run** attached menu selects commits, suites, and platforms and skips commits that already have results. Close the menu with its divider; reopening retains its draft. Results are cached in extension storage; see [Benchmark results](../../../documentation/references/performance/0006-benchmark-results.md).

```sh
pst pstdio-dev benchmarks sync
pst pstdio-dev benchmarks start-run --commits pstdio@0.45.0 --commits main --platforms linux-x64
```

The pages use your GitHub CLI login. Run `gh auth login` in this repository first.

## Release pipeline health

Open **Release health** from the project navigation to see the release charts and run evidence on one dashboard. Use **Edit dashboard** on the right of the toolbar to arrange widgets for the open page.

**Range** and **Aggregation** apply to the dashboard charts. Choose the last 7, 30, or 90 days or all available history, grouped by day, week, or month in UTC. The last 7 days can also be grouped by hour. Weeks start on Monday. The range also applies to the **Release runs** widget, where each run has its duration, GitHub link, and verification evidence.

Under **Edit dashboard**, add a **Scatterplot** or **Ring chart** with the **Release run analysis** source. The scatterplot places one point for each timed run with test evidence, using duration and failed test count. Its colors identify verification outcomes. The ring shows the share of those runs in each outcome.

**PR merge themes** shows semantic groups from a project analysis. Choose a theme and switch between merge count and share of all merges. Select **All time** and **Month** to see the full history. Merges without an assignment appear as **Unclassified**.

The chart reads `releases/merge-themes.json` from the `pstdio.dev` extension's project storage. To update it, replace the file with a version 1 snapshot containing `repository` (GitHub owner/name), `analyzedAt` (UTC timestamp), `names` (theme labels in display order), and `byPull` (PR number to zero-based theme index). Refresh Release health to load the snapshot. Assignments apply to PRs merged through the snapshot timestamp.

**Bug failure patterns** shows analyzed bug-fix PRs by pattern. View fix counts or each pattern’s share of analyzed fixes, and select a pattern to see its history. The default stack shows **Validation or delivery only** separately. The patterns describe what the fixes addressed, and the date shows the analysis cutoff.

This widget reads `releases/bug-failure-patterns.json` in the same snapshot format. Its `validationIndices` array identifies the patterns that belong to validation or delivery.

Dashed vertical lines mark GitHub publication dates for `pstdio@` releases. When several releases fall in the same bucket, the tooltip lists each tag and timestamp. The test charts sum recorded executions and average completed run durations. Dates outside the available workflow history have gaps in the test charts.

Select a legend item in **PR merges** or **Total tests** to show that category. Select the same item again to restore the full stack.

**PR merges** stacks GitHub pull request merges by **Bug**, **Feature**, and **Chore**. The tooltip shows the total and all three counts for each bar. A failed refresh keeps the last saved counts and shows a warning on **Overview**.

Each PR has one category. The extension uses the project's saved GPT-6 Luna classifications for the historical backfill and uses title conventions for later PRs. The CLI exposes daily `pullRequestMerges` and weekly `pullRequestMergesWeekly` with counts under `categories`.

**Velocity** multiplies the number of merged feature PRs by their average complexity in each day or week. It reads the Complexity rating of the Planner ticket in the PR title, one ticket at a time. Each refresh rereads tickets of features merged in the last 30 days and tickets it has not read yet; older ratings come from the saved timeline. The default scale gives Simple, Moderate, and Complex 1, 2, and 3 points. Features without a rating use the middle weight. The tooltip and CLI report how many feature PRs used that default.

**Estimated bugs per feature** divides follow-up bug-fix PRs attributed to a feature by all feature PRs merged in the selected period. A fix counts toward the period when its originating feature merged. The saved Luna audit records the PR numbers, evidence, and confidence for explicit and inferred links, and identifies fixes with no reliable origin. The chart uses one merged fix PR as a proxy for one bug and includes fixes merged after their origin and through the review date. Recent features have had less time to receive fixes. The CLI exposes period counts under `bugOrigins` and review totals under `bugOriginCoverage`.

The panel reads runner summaries, including quarantined cases, through your GitHub CLI login. It refreshes on opening, on demand, and daily; completed job counts are cached under this extension's project storage. Missing reports and unavailable logs remain explicit. A refresh preserves previous results if GitHub is unavailable. The initial history covers the latest ten release candidates among the latest 100 workflow runs, including main pushes that resume an unpublished release. Pushes that only update the version PR do not count toward that limit.

```sh
pst pstdio.dev release-health sync
pst pstdio.dev release-health history
pst pstdio.dev release-health inspect
pst pstdio.dev release-health inspect --run-id 43304493970
```

All release-health data is available as CLI JSON. `sync` starts or reuses a background refresh. `history` returns the cached PR merge counts, release runs, test evidence, and collection errors shown on the page. Its `sync` field contains the background run's ID, exact status, timestamps, result, and structured error. It is `null` before a refresh or after that automation record expires. `syncedAt` records the most recent saved run, so it can advance while `syncing` is still true.

```sh
# Inspect refresh state without opening the page.
pst pstdio.dev release-health history | jq '{syncedAt, syncing, error, sync}'
# Read the daily merge counts and their refresh error, if any.
pst pstdio.dev release-health history | jq '{pullRequestMerges, pullRequestMergesError}'
# Read the newest cached run, including every chart value and failure detail.
pst pstdio.dev release-health history | jq '.runs | reverse | .[0]'
```

`inspect` compares the latest GitHub release workflow run, or the requested run ID, with its cached evidence. It returns live run metadata and job statuses, the cached result (or `null`), sync state, collection limits, and an eligibility decision with its reason. If GitHub's job request fails, the command preserves run metadata, cached evidence and sync status, reports the error, and returns `null` for jobs and eligibility. Inspection uses the same eligibility rule as collection and does not download logs or change the cache. Eligibility does not imply a run is already cached: collection scans at most 100 workflow runs and processes the latest ten eligible candidates per refresh. The Runs table shows cached runs newest first; chart history stays oldest first.

## Diagnostics

Expand **Diagnostics** in the project navigation to open **Startup timeline** or **Storage**. Both read the files of the runtime they run in (`$PSTDIO_HOME`, by default `~/.pstdio`) and change nothing.

**Startup timeline** groups the runtime's `runtime.startup.phase`, `runtime.setup.phase`, and shutdown log lines from `logs.jsonl` into launches, newest first. **Range** filters launches to the last 7, 30, or 90 days, or all available history. **Aggregation** groups the startup chart by day, week, or month in UTC; weeks start on Monday. The chart shows each period's average time to a ready runtime and average slowest project setup, and its tooltip adds the launch count and slowest ready time. Select a launch in the chart or the table to see its startup steps and every project setup as a waterfall, including nested steps, the wait between a ready runtime and the first setup, and setups cut short by quitting (`interrupted`) or by a failed step.

**Storage** shows the latest report and measures a new one on demand in about 20 seconds as a background job. The database section reads the PGlite data directory without opening it: on-disk size per table split into rows, out-of-line large values (TOAST), and indexes, plus `storage_documents` bytes per owner and document kind, live versus dead. A warning appears when large values exceed a quarter of the database, because the database should hold references only ([0006.2.16](../../../documentation/guidance/0006-engineering.md#2-system-design)). The files section sizes every entry of the app data folder, each `storage/` area, and this project's extension storage folders. Worktrees under `workspaces/` are skipped.

Select a known database table to inspect its definition in **Schema**, or search and filter the table list there. Table details include columns, primary keys, nullability, defaults, enum values, indexes, and foreign keys. Select a foreign key to open its referenced table. **Graph** shows the entire schema with primary and foreign key columns. Choose a table to show all columns in that table and its direct relationships. Use the shared diagram controls to zoom, pan, or open fullscreen.

Definitions come from the newest checked-in PostgreSQL snapshot in `packages/pstdio-db/drizzle/meta`, read from the project's default workspace. They describe the declared schema and can differ from the running database. **Reload schema** reads the snapshot again without measuring files or opening the database.

```sh
pst pstdio.dev diagnostics startup-timeline
pst pstdio.dev diagnostics storage-refresh
pst pstdio.dev diagnostics storage-report
pst pstdio.dev diagnostics database-schema
```

## Session insights

Open **Session insights** in the project navigation to sort this project's agent sessions into successes and failure modes, then turn repeated failures into skills and documentation. A session's status says whether the run ended, not whether it worked, so the extension reads the conversations in two stages:

1. **Scan** reads new or changed sessions and records signals: corrections, resume nudges, tool failures, errors and exits. It settles infrastructure failures and clean single-request successes and flags everything else for review. It makes no model calls.
2. **Review** (**Review with agent** in the table) starts an agent session with the [Analyze agent sessions](skills/analyze-agent-sessions/SKILL.md) skill. The agent reads bounded transcripts, records a verdict with evidence and a lesson, and drafts skill and documentation proposals from the report. It does not edit repository guidance itself.

Agent verdicts outrank heuristics. A later scan keeps them unless the session gains new turns, and then flags it for review again. The table starts on **Failures**, grouped by failure mode; other views show sessions that need review, successes, infrastructure failures and everything. Open a row to go to the session. Sessions from `*.fake` test harnesses, running sessions and the review agent's own sessions are skipped. The taxonomy and the usual fix for each mode live in [`src/insights/taxonomy.ts`](src/insights/taxonomy.ts).

```sh
pst pstdio.dev insights scan                          # --rescan re-reads unchanged sessions
pst pstdio.dev insights list --needs-review           # what an agent should classify next
pst pstdio.dev insights transcript --session-id <id>  # bounded digest of one session
pst pstdio.dev insights classify --session-id <id> --outcome partial --failure-mode unwanted_action \
  --evidence 'User: "..."' --lesson "..." --remediation-target AGENTS.md
pst pstdio.dev insights report --agent-only           # Markdown grouped by mode, lessons and fix targets
pst pstdio.dev insights taxonomy                      # outcomes and failure modes
pst pstdio.dev insights review --limit 30             # start a review agent
```

Reports go to `.pstdio/extension-storage/pstdio.dev/reports/`.

## Merge queue repair

When enabled, the automation checks every five minutes for pull requests that GitHub removed from the merge queue. It lists open pull requests with the `removed-from-queue` label, which the Merge queue removals workflow manages. For each one, it creates a workspace from the pull request's branch and starts a session that reproduces and fixes the failure, then pushes to the same branch. A pull request gets one repair session per queue removal, identified by its latest removal event's timestamp. A repair's own push does not start another session. A later removal after requeueing can start a fresh repair. Session history includes older pages and archived sessions. If one pull request's repair cannot start, the command tries the others before reporting the failed pull requests and their errors. Pull requests from forks are skipped. The command needs an authenticated `gh` CLI.

## Release dry run repair

The Release Dry Run workflow verifies the next stable candidate at 09:00 and 21:00 UTC. When enabled, this automation checks every ten minutes for the newest finished dry run. If it failed, the automation creates a workspace from `origin/main` and starts one session with the [fix-release-pipeline](skills/fix-release-pipeline/SKILL.md) skill and the run's failed jobs. The session fixes every failure in one pull request, merges it after review, and starts one confirmation dry run.

Only one repair or escalation session runs at a time, and a session waiting for input still counts. A failed run gets at most one repair session. A newer run, including a rerun that is still going, replaces older failures. When the same job fails three dry runs in a row with a repair after each, the automation starts an escalation session instead. That session changes no code: it files a planner ticket with the evidence and asks the maintainer to decide. Escalated jobs stay with the maintainer until a green dry run ends the red streak: later repairs in that streak leave them alone, and other failing jobs still get repaired. The command needs an authenticated `gh` CLI.

## Skills

[Patch release](skills/patch-release/SKILL.md) prepares and verifies fixes for the current stable release, then publishes them when requested. It keeps unrelated main changes out of the patch and uses the existing signing identity.

[Discord release announcement](skills/discord-release-announcement/SKILL.md) helps agents draft, publish, and update Prompt Studio release announcements. It covers Discord formatting, release links, screenshots, blog GIFs, alt text, and publication checks. Publishing requires a user request to send or publish the announcement.

[Analyze agent sessions](skills/analyze-agent-sessions/SKILL.md) classifies past agent sessions as successes or failure modes through the `pst pstdio.dev insights` commands, then drafts skill and documentation proposals from repeated failures.

[Write a blog post](skills/write-blog-post/SKILL.md) helps agents write, illustrate, preview, and publish blog posts. It covers release post structure, benchmark charts, GIFs, screenshots, code examples, drafts, and publication checks. Its [bento chart script](skills/write-blog-post/scripts/bento-chart.ts) draws benchmark charts as paired light and dark SVGs.
