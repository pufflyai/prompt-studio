# Worktrees

## What is pstdio-wt?

`pstdio-wt` is a low-level Git worktree SDK. It wraps Git commands behind a typed API so the rest of the app never shells out to Git directly. It has **zero external dependencies** — only Bun's native `spawn`.

## Where it fits

```
┌─────────────────────────────────────────────────────┐
│  pstdio (CLI)                                       │
│                                                     │
│  ┌─────────────────────┐  ┌──────────────────────┐  │
│  │ create-workspace-   │  │ delete-workspace.ts  │  │
│  │ for-ticket.ts       │  │                      │  │
│  │                     │  │ removeWorktreeAnd-   │  │
│  │ createWorktree()    │  │ Branch()             │  │
│  └────────┬────────────┘  └──────────┬───────────┘  │
│           │                          │              │
│  ┌────────┴──────────────────────────┴───────────┐  │
│  │ merge-workspace.ts                            │  │
│  │                                               │  │
│  │ git(), mergeWorktree(), removeWorktreeAnd-    │  │
│  │ Branch()                                      │  │
│  └───────────────────────┬───────────────────────┘  │
└──────────────────────────┼──────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────┐
│  pstdio-wt (SDK)                                     │
│                                                      │
│  git.ts ─────────── single entry point for all       │
│  │                  git commands (Bun.spawn)          │
│  │                                                   │
│  ├─ worktree.ts ─── create / remove / list / find    │
│  ├─ commit.ts ───── stage + commit (staging policy)  │
│  ├─ merge.ts ────── ff-only or squash merge          │
│  ├─ rebase.ts ───── rebase onto target               │
│  ├─ status.ts ───── dirty / conflicts / ahead-behind │
│  ├─ hooks.ts ────── lifecycle hook resolution + exec  │
│  ├─ setup.ts ────── run scripts inside a worktree    │
│  ├─ default-branch.ts ── detect main/master          │
│  └─ copy-ignored.ts ─── copy node_modules etc.       │
│                                                      │
│  types.ts ─────────── shared type definitions        │
└──────────────────────────────────────────────────────┘
                           │
                           ▼
                        Git CLI
```

## How the app uses it

The main `pstdio` package has three workspace operations that all delegate to `pstdio-wt`:

| Operation        | CLI module                       | SDK functions used                                |
| ---------------- | -------------------------------- | ------------------------------------------------- |
| Create workspace | `create-workspace-for-ticket.ts` | `createWorktree`                                  |
| Delete workspace | `delete-workspace.ts`            | `removeWorktreeAndBranch`                         |
| Merge workspace  | `merge-workspace.ts`             | `git`, `mergeWorktree`, `removeWorktreeAndBranch` |

The CLI modules handle the **application logic** (API calls, DB records, user prompts) while `pstdio-wt` handles the **git plumbing**.

## Worktree lifecycle

```
  create          work           commit          merge          cleanup
    │               │               │               │              │
    ▼               ▼               ▼               ▼              ▼
┌────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌────────┐
│ create │───▶│  agent   │───▶│  commit  │───▶│  merge   │───▶│ remove │
│Worktree│    │  works   │    │ Changes  │    │Worktree  │    │Worktree│
└────────┘    └──────────┘    └──────────┘    └──────────┘    └────────┘
  ▲     │                      ▲     │         ▲     │        ▲     │
  │     │                      │     │         │     │        │     │
 pre   post                   pre   post      pre   post     pre   post
create create                commit commit   merge  merge   remove remove
                                              │
                                           on-conflict
```

### Hooks

Hooks run automatically at each lifecycle stage. All hooks are SDK plugins in `.pstdio/plugins/` defined via `definePlugin`. `pre-*` hooks are blocking (non-zero exit or rejection aborts the operation). `post-*` hooks are non-blocking. See `.pstdio/docs/product/cli/hooks.md` for the full reference.

## Key design choices

- **Branch name = stable identifier.** Worktree paths are derived from branch names, not the other way around.
- **Dependency injection.** All consumer modules accept a `deps` parameter defaulting to real implementations, making tests simple.
- **No shell directory switching.** The CLI returns paths — it never tries to `cd` the parent shell.
- **Default branch resolved at runtime.** Never hardcoded to `main` or `master`.
- **Safety by default.** `removeWorktree` refuses to delete dirty worktrees unless `force: true`.

## Full PRD

See `packages/pstdio-wt/readme.md` for the complete feature PRD, implementation status table, and Worktrunk references.
