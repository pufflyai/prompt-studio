# Worktrees and Git operations

`pstdio-wt` supplies Git operations for local workspace providers and CLI workflows. It depends on the shared file-type package and invokes the Git executable. It does not own project, ticket, review, or session state.

## Operations and ownership

| Operation | Product owner | Git implementation |
| --- | --- | --- |
| Create a worktree workspace | API workspace provider | `createWorktree` |
| Remove a worktree workspace | API workspace provider and workspace lifecycle | Worktree/branch cleanup functions |
| Merge a local workspace | CLI merge workflow | Merge, status, and cleanup helpers |
| Planner implementation/review | Planner commands | Calls host workspace APIs; does not duplicate Git ownership |

The CLI create/delete commands call the API. The API resolves the provider and local repository context. Merge remains a local CLI workflow. Remote providers own their own execution and capability boundaries.

## Package structure

See the [public exports](../../../packages/pstdio-wt/src/index.ts) for the available functions. Focused modules cover Git subprocess execution, worktree operations, commits, merges, rebases, branch/base resolution, status, setup, and ignored-file copying.

`branches.ts` and `resolve-base.ts` resolve branch state and the base commit. Callers supply lifecycle callbacks; the package does not discover product extension hooks itself.

## Lifecycle rules

1. Resolve repository location and provider capabilities before running Git.
2. Keep workspace ID, shorthand, branch name, and filesystem path distinct. The provider owns their mapping.
3. Run provision hooks through the host before marking a workspace ready.
4. Persist workspace state and publish changes through the owning service.
5. Respect dirty-worktree checks and explicit force semantics during cleanup.
6. Resolve the target/base branch from the current repository. Do not assume `main` or `master`.
7. Return the path to a caller; a subprocess cannot change its parent shell's directory.

See [control and execution ownership](0005-control-and-execution-planes.md), [workspace commands](../cli/0005-workspaces.md), and the [worktree source](../../../packages/pstdio-wt/src/index.ts).
