# Prompt Studio development extension

This repository-local extension prepares worktrees and controls isolated development stacks.

## CLI commands

```sh
pst pstdio-dev workspace openInVscode --workspace-id <id>
pst pstdio-dev workspace openInIsolation --workspace-id <id>
pst pstdio-dev workspace stopIsolation --workspace-id <id>
```

`openInVscode` opens the workspace worktree in VS Code. `openInIsolation` starts the repository's isolated development stack and opens its dashboard. `stopIsolation` stops that stack.

The extension also installs dependencies and builds a new worktree after the workspace-ready event.
