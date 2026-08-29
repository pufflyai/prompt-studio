# Prompt Studio Dev extension

This repository-local extension prepares Prompt Studio worktrees, controls isolated development stacks, and discovers high-impact issues.

## CLI commands

```sh
pst pstdio-dev workspace open-in-vscode --workspace-id <id>
pst pstdio-dev workspace open-in-isolation --workspace-id <id>
pst pstdio-dev workspace stop-isolation --workspace-id <id>
```

`open-in-vscode` opens the workspace worktree in VS Code. `open-in-isolation` starts the repository's isolated development stack and opens its dashboard. `stop-isolation` stops that stack.

The extension also installs dependencies and builds a new worktree after the workspace-ready event.

At noon each day, it starts an evidence-gated search for one high-impact issue. It creates a planner ticket only when the search reproduces a valuable, untracked problem.
