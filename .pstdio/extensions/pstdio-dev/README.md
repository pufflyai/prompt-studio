# Prompt Studio Dev extension

This repository-local extension prepares Prompt Studio worktrees, controls isolated development stacks, discovers high-impact issues, and tracks benchmark performance.

## CLI commands

```sh
pst pstdio-dev workspace open-in-vscode --workspace-id <id>
pst pstdio-dev workspace open-in-isolation --workspace-id <id>
pst pstdio-dev workspace stop-isolation --workspace-id <id>
```

`open-in-vscode` opens the workspace worktree in VS Code. `open-in-isolation` starts the repository's isolated development stack and opens its dashboard. `stop-isolation` stops that stack.

The extension also installs dependencies and builds a new worktree after the workspace-ready event.

At noon each day, it starts an evidence-gated search for one high-impact issue. It creates a planner ticket only when the search reproduces a valuable, untracked problem.

## Performance

The **Performance** item in the project navigation opens three pages. **Trends** shows every benchmark across releases, or every benchmark in one release. **Compare** compares two commits. **Runs** starts benchmark runs on GitHub Actions. Results are cached in extension storage; see [Benchmark results](../../../documentation/references/performance/0006-benchmark-results.md).

```sh
pst pstdio-dev benchmarks sync
pst pstdio-dev benchmarks start-run --commits pstdio@0.45.0 --commits main
```

The pages use your GitHub CLI login. Run `gh auth login` in this repository first.

## Merge queue repair

Every five minutes, it repairs pull requests that GitHub removed from the merge queue. It lists open pull requests with the `removed-from-queue` label, which the Merge queue removals workflow manages. For each one, it creates a workspace from the pull request's branch and starts a session that reproduces and fixes the failure, then pushes to the same branch. A pull request gets one repair session per queue removal, identified by its latest removal event's timestamp. A repair's own push does not start another session. A later removal after requeueing can start a fresh repair. Session history includes older pages and archived sessions. If one pull request's repair cannot start, the command tries the others before reporting the failed pull requests and their errors. Pull requests from forks are skipped. The command needs an authenticated `gh` CLI.

## Skills

[Patch release](skills/patch-release/SKILL.md) prepares and verifies fixes for the current stable release, then publishes them when requested. It keeps unrelated main changes out of the patch and uses the existing signing identity.

[Discord release announcement](skills/discord-release-announcement/SKILL.md) helps agents draft, publish, and update Prompt Studio release announcements. It covers Discord formatting, release links, screenshots, blog GIFs, alt text, and publication checks. Publishing requires a user request to send or publish the announcement.

[Write a blog post](skills/write-blog-post/SKILL.md) helps agents write, illustrate, preview, and publish blog posts. It covers release post structure, benchmark charts, GIFs, screenshots, code examples, drafts, and publication checks. Its [bento chart script](skills/write-blog-post/scripts/bento-chart.ts) draws benchmark charts as paired light and dark SVGs.
