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

## Skills

[Patch release](skills/patch-release/SKILL.md) prepares and verifies fixes for the current stable release, then publishes them when requested. It keeps unrelated main changes out of the patch and uses the existing signing identity.

[Discord release announcement](skills/discord-release-announcement/SKILL.md) helps agents draft, publish, and update Prompt Studio release announcements. It covers Discord formatting, release links, screenshots, blog GIFs, alt text, and publication checks. Publishing requires a user request to send or publish the announcement.

[Write a blog post](skills/write-blog-post/SKILL.md) helps agents write, illustrate, preview, and publish blog posts. It covers release post structure, benchmark charts, GIFs, screenshots, code examples, drafts, and publication checks. Its [bento chart script](skills/write-blog-post/scripts/bento-chart.ts) draws benchmark charts as paired light and dark SVGs.
