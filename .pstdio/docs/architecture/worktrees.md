# Worktrees

`pstdio-wt` wraps Git operations for worktree creation, restoration, removal, commits, merges, rebases, and diffs. Product code owns workspace records and provider lifecycle. The Git package owns Git commands.

## Ownership

| Layer | Responsibility |
| --- | --- |
| Core database | Allocate project prefixes and workspace references; retain UUID relationships |
| Workspace provider | Create or restore backing resources; persist their branch, path, and provider reference; clean them up |
| CLI, SDK, and extensions | Request operations through the workspace API |
| `pstdio-wt` | Run Git operations on the recorded branch and path |

The core allocator gives every project an immutable, globally unique prefix of at most 16 uppercase letters and digits. Duplicate candidates receive a numeric suffix. Deleted projects reserve their prefixes. Every workspace uses `<prefix>_WS-<n>`; the root checkout reserves zero and isolated workspaces share one increasing sequence starting at one. Archived and deleted records reserve their numbers. UUIDs remain internal relationship keys. Resource anchors link Planner tickets to workspaces; ticket IDs do not name workspaces.

## Creation and restoration

New built-in worktrees use `workspace/<reference>` and `$PSTDIO_HOME/workspaces/<reference>`. `createWorktree` refuses an occupied directory or an existing branch. `restoreWorktree` is for a workspace's recorded branch and path. It retains commits and edits and returns Git's actual path.

Cleanup uses recorded ownership; it never guesses a branch from a public reference. The API provider owns deletion, so the CLI does not repeat local Git cleanup. Extension providers own their remote layouts. `removeWorktree` refuses dirty worktrees unless the caller explicitly requests force removal.

The CLI returns the created path; it cannot change the parent shell's directory. Base branch selection is resolved at runtime. Product lifecycle automation runs through extension events and commands, outside the Git package.

## Identity migration

Migration 0032 assigns references in creation-time and UUID order before adding database uniqueness constraints. It preserves valid unique references when possible. It leaves UUIDs, anchors, sessions, names, branches, paths, provider references, and execution targets unchanged. The database directory receives `workspace-identity-migration.json` before data changes, with old/new references and duplicate recorded paths. Shared historical directories require deliberate inspection and repair; renaming references does not separate their files. No old-reference aliases are retained.

Extension resource sequences retain their existing prefixes and counters, so existing ticket references remain valid. A newly allocated extension sequence uses the project's current prefix. Planner derives its current workspace display reference from core when reading an attempt; the next normal write stores it. Historical attempts whose workspace was deleted retain their last display snapshot and UUID linkage.

See `packages/pstdio-wt/readme.md` for the low-level Git API.
