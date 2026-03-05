# Worktree Agent Flow Spec (Worktrunk-inspired / Worktrunk-backed)

Status: draft  
Audience: implementer of a Bun CLI  
Date: 2026-03-05

## 1. Objective

Build a Bun helpers for **isolated agent tasks in Git worktrees**, modeled after the parts of Worktrunk that matter most for agent handoff:

1. create a worktree
2. run a setup script in that folder
3. pass the location to an agent
4. let the agent make changes
5. commit results
6. switch to results for verification
7. merge results

This spec is based primarily on the official Worktrunk docs. The linked YouTube video is useful as framing, but I could only verify its title/description metadata here, not a full transcript, so the detailed behavior below comes from the docs.[^video]

---

## 2. What Worktrunk actually offers

### 2.1 Core worktree lifecycle

Worktrunk’s center of gravity is:

- `wt switch` — switch to or create a worktree by **branch name**
- `wt list` — view all worktrees with status
- `wt remove` — delete worktrees safely
- `wt merge` — integrate a branch back into the target and optionally clean it up[^overview][^switch][^merge]

The important design choice is that Worktrunk treats **branch name as the stable identifier** and computes worktree paths from a configurable template, instead of making callers manage both branch and path manually.[^overview][^config]

### 2.2 Automation hooks

Worktrunk has hooks at all the lifecycle points relevant to agent workflows:[^hook]

- `pre-switch`
- `post-create`
- `post-start`
- `post-switch`
- `pre-commit`
- `pre-merge`
- `post-merge`
- `pre-remove`
- `post-remove`

The two most relevant for your flow are:

- `post-create` — **blocking**, for setup that must finish before the user/agent works
- `post-start` — **background**, for long-running setup like dev servers or cache copy[^hook]

### 2.3 Agent handoff

Worktrunk supports `wt switch --execute ...`, which runs a command after switching and is explicitly meant for launching editors or AI agents. It also supports `--no-cd` for automation contexts where changing the shell directory is not appropriate.[^switch]

### 2.4 Scriptability

`wt list --format=json` is the main machine-facing surface. It exposes fields like:

- `branch`
- `path`
- `kind`
- `working_tree`
- `main`
- `remote`
- `ci`
- `url`
- `statusline`
- `symbols`
- `is_current`
- `is_previous`[^list]

This is the cleanest way for another tool to discover the created worktree path and status.

### 2.5 Commit / merge helpers

Worktrunk supports both high-level and low-level integration flows:[^merge][^step]

- `wt step commit` — stage and commit changes
- `wt step squash` — squash changes since branching
- `wt merge` — squash/commit, rebase, run pre-merge hooks, fast-forward merge, clean up

Important nuance: if you want **commit** and **merge** to be separate user-visible steps, the cleanest Worktrunk-backed pattern is:

- explicit commit first (`wt step commit` or plain git commit)
- later merge with `wt merge --no-commit`[^merge][^step]

### 2.6 Performance helpers

`wt step copy-ignored` copies gitignored files like `node_modules/`, `target/`, caches, and `.env` files between worktrees. The docs recommend:

- use `post-start` when the copy can happen in the background
- use `post-create` when the agent needs those files **before launch**[^step][^hook]

### 2.7 Optional UX features

Useful, but not required for your first version:

- interactive picker for `wt switch` with preview panes
- PR/MR checkout via `pr:N` / `mr:N`
- CI status in `wt list --full`
- dev-server URL display in `wt list`
- LLM commit messages / summaries
- Claude activity markers[^switch][^list][^llm][^claude]

---

## 3. Feature breakdown for your Bun CLI

## 3.1 Must-have (MVP)

### A. Create a worktree by branch name

Requirements:

- Accept a task branch name.
- Allow optional base branch.
- Be idempotent: if the worktree already exists, return it instead of failing.
- Return structured data including:
  - `branch`
  - `path`
  - `base`
  - `created: boolean`
  - `currentStatus`

Worktrunk mapping:

- `wt switch --create --no-cd --yes <branch>`
- optionally `--base <base>`[^switch]

### B. Run setup in the worktree

Requirements:

- Support a **blocking setup step** that finishes before the agent starts.
- Support a **background setup step** for slower, non-critical work.
- Capture stdout/stderr and exit code.
- Persist whether setup completed successfully.

Worktrunk mapping:

- blocking: `post-create`
- background: `post-start`[^hook]

### C. Hand off the path to an agent

Requirements:

- Pass the resolved worktree path to an agent command.
- Support passing an initial prompt/task string.
- Capture the agent process exit code.
- Persist which agent was launched and with what arguments.
- Do not rely on `cd` in the parent shell.

Worktrunk mapping:

- `wt switch --execute <cmd>` if Worktrunk owns handoff
- or `wt list --format=json` + `Bun.spawn(...)` if your CLI owns handoff[^switch][^list]

### D. Observe task state while the agent works

Requirements:

- Query current dirty/clean state.
- Query ahead/behind relative to default branch.
- Detect merge conflicts / rebase state.
- Distinguish “branch exists but no worktree” vs “worktree exists”.

Worktrunk mapping:

- `wt list --format=json`[^list]

### E. Commit results

Requirements:

- Support explicit commit as a separate step.
- Allow either:
  - a caller-supplied message, or
  - generated/default message behavior.
- Support staging policy:
  - all changes
  - tracked only
  - already staged only

Worktrunk mapping:

- `wt step commit`
- or plain git commit if you want full control[^step]

### F. Verify results

Requirements:

- Expose a verify action that lets the developer inspect the result worktree.
- In a Bun CLI, verification should mean one of:
  - print the path
  - open editor at path
  - spawn shell/editor/tool at path
- Do **not** assume the Bun process can change the parent shell’s current directory.

Worktrunk mapping:

- `wt switch <branch>` in an interactive shell
- `--no-cd` / path-return behavior for automation[^switch][^config]

### G. Merge results

Requirements:

- Merge only after explicit verification.
- Rebase onto target before merge unless disabled.
- Run validation checks before merge.
- Prefer fast-forward merge into target.
- Remove or keep worktree based on flag.
- Surface conflicts clearly.

Worktrunk mapping:

- explicit commit flow: `wt merge --no-commit [target]`
- auto-commit flow: `wt merge [target]`[^merge]

---

## 3.2 Strongly recommended

### H. Safe cleanup

Requirements:

- Refuse to delete worktrees with uncommitted changes unless forced.
- Distinguish “remove worktree” from “delete branch”.
- Allow keeping the branch even after removing the worktree.

Worktrunk mapping:

- `wt remove`
- Worktrunk’s cleanup logic recognizes integrated branches beyond naive ancestry checks.[^faq]

### I. Copy ignored files for warm starts

Requirements:

- Optional cache/dependency copy before or during agent launch.
- Must work for Bun/Node repos with heavy `node_modules` or build outputs.

Worktrunk mapping:

- `wt step copy-ignored` in `post-create` or `post-start`[^step][^hook]

### J. Default branch discovery

Requirements:

- Never hardcode `main`.
- Resolve repo default branch dynamically and cache it.

Worktrunk mapping:

- `wt config state default-branch`[^config]

### K. Structured status API

Requirements:

- Every CLI action should have a `--json` mode.
- Status should expose path, branch, dirty state, ahead/behind, conflicts, and whether the worktree is current.

Worktrunk mapping:

- mirror `wt list --format=json` as your internal model[^list]

---

## 3.3 Defer for v2

- interactive picker UI
- PR/MR checkout shortcuts
- CI status aggregation
- dev server URL integration
- LLM branch summaries
- direct integration with Worktrunk’s Rust crate API

Reason to defer the Rust crate: the crate docs explicitly say the **library API is not stable**, so a Bun CLI should treat Worktrunk as an external CLI backend rather than a library dependency.[^docsrs]

---

## 4. Recommended workflow design

## 4.1 Preferred user flow

### Start task

1. resolve default branch
2. create/switch worktree
3. run blocking setup
4. optionally run background setup
5. launch agent with worktree path
6. store task metadata

### Review / verify

1. query status
2. open the worktree path in editor/shell/tool
3. inspect diffs
4. optionally run validation locally

### Commit

1. stage according to policy
2. create a commit
3. record commit SHA

### Merge

1. rebase onto target
2. run pre-merge validation
3. fast-forward merge target
4. optionally remove worktree and branch
5. report final result

---

## 5. Suggested Bun CLI surface

These command names are suggestions, not a requirement.

```text
mytool task start <branch> [--base <branch>] [--agent <cmd>] [--prompt <text>] [--json]
mytool task status [branch] [--json]
mytool task commit <branch> [-m <message>] [--stage all|tracked|none] [--json]
mytool task verify <branch> [--open code|cursor|shell|none] [--json]
mytool task merge <branch> [--target <branch>] [--keep-worktree] [--json]
mytool task remove <branch> [--force] [--keep-branch] [--json]
```

### Suggested internal TypeScript API

```ts
type TaskRecord = {
  branch: string;
  base: string;
  path: string;
  created: boolean;
  setup: {
    blockingOk: boolean;
    backgroundStarted: boolean;
  };
  agent?: {
    command: string;
    args: string[];
    prompt?: string;
    pid?: number;
    exitCode?: number | null;
  };
  git: {
    dirty: boolean;
    conflicts: boolean;
    aheadOfBase: number;
    behindBase: number;
    lastCommitSha?: string;
  };
};

async function startTask(opts: {
  repoRoot: string;
  branch: string;
  base?: string;
  agent?: string;
  prompt?: string;
}): Promise<TaskRecord>;

async function getTaskStatus(opts: {
  repoRoot: string;
  branch?: string;
}): Promise<TaskRecord[]>;

async function commitTask(opts: {
  repoRoot: string;
  branch: string;
  message?: string;
  stage?: "all" | "tracked" | "none";
}): Promise<{ sha: string }>;

async function verifyTask(opts: {
  repoRoot: string;
  branch: string;
  open?: "code" | "cursor" | "shell" | "none";
}): Promise<{ path: string }>;

async function mergeTask(opts: {
  repoRoot: string;
  branch: string;
  target?: string;
  keepWorktree?: boolean;
}): Promise<{ merged: boolean; target: string }>;
```

---

## 6. State model

Recommended task states:

- `new`
- `creating`
- `setup_running`
- `ready`
- `agent_running`
- `agent_finished`
- `dirty`
- `committed`
- `verification_pending`
- `verified`
- `merge_running`
- `merged`
- `removed`
- `failed`

Minimum transitions:

```text
new -> creating -> setup_running -> ready -> agent_running
agent_running -> dirty | failed
dirty -> committed
committed -> verification_pending -> verified
verified -> merge_running -> merged
merged -> removed (optional)
```

---

## 7. Worktrunk-backed implementation notes

### 7.1 Use Worktrunk as a subprocess backend

Recommended approach:

- call `wt` via `Bun.spawn` / `Bun.spawnSync`
- parse `wt list --format=json`
- use `wt config state default-branch`
- avoid depending on the Rust crate API[^docsrs]

### 7.2 Do not depend on parent-shell directory switching

Shell integration is required for Worktrunk itself to change directories in an interactive shell. A Bun subprocess cannot reliably change the caller’s parent shell directory, so your CLI should treat “switch to results” as **return/open path**, not literal shell navigation.[^config]

### 7.3 Prefer explicit control for setup and agent launch

Two valid patterns:

#### Pattern A — your CLI owns setup and agent launch

Use Worktrunk only for worktree lifecycle and status.

Pros:

- simpler observability
- easier logs / retries
- easier multi-agent support

Recommended commands:

- create: `wt switch --create --no-cd --yes <branch>`
- discover path: `wt list --format=json`
- run setup: your Bun code
- run agent: your Bun code

#### Pattern B — Worktrunk owns setup and/or agent handoff

Use hooks plus `--execute`.

Pros:

- less wrapper code
- closer to native Worktrunk workflow

Recommended commands:

- setup in `.config/wt.toml` with `post-create`
- launch via `wt switch --create -x <agent> <branch>`[^switch][^hook]

For your flow, **Pattern A is usually the better fit** because your Bun CLI becomes the source of truth for state, prompts, retries, and logging.

### 7.4 Recommended merge mode for your exact flow

Because your flow has an explicit **commit results** step before **merge results**, prefer:

1. commit explicitly with `wt step commit` or plain git commit
2. verify manually
3. merge with `wt merge --no-commit`

That keeps commit and merge separate while still using Worktrunk’s rebase / pre-merge / cleanup pipeline.[^merge][^step]

---

## 8. Acceptance criteria

The implementation is acceptable when all of the following are true:

1. A single CLI command can create or reuse a worktree for a named task branch.
2. The CLI can run a blocking setup step in that worktree and fail fast on setup errors.
3. The CLI can launch an agent with the exact resolved worktree path.
4. The CLI can report worktree status in structured JSON.
5. The CLI can commit results as an explicit, separate step.
6. The CLI can expose a verification step without assuming parent-shell `cd`.
7. The CLI can merge verified work back to the target branch with validation hooks.
8. The CLI can optionally remove the worktree after merge.
9. The CLI does not hardcode the default branch name.
10. The CLI remains usable even when Worktrunk shell integration is absent.

---

## 9. Minimal recommendation

If you only build the smallest useful slice, build this:

- create/reuse worktree
- blocking setup
- pass path to agent
- JSON status
- explicit commit
- verify by returning/opening path
- merge with `--no-commit`

Everything else can wait.

---

## 10. Implementation status (pstdio-wt SDK)

| Feature | Spec | Status | Module |
|---|---|---|---|
| A. Create worktree by branch | 3.1.A | Done | `worktree.ts` — `createWorktree` (idempotent) |
| B. Run setup (blocking) | 3.1.B | Done | `setup.ts` — `runSetup`, `runSetupScript` |
| B. Run setup (background) | 3.1.B | Deferred | Not needed for current flows |
| C. Hand off path to agent | 3.1.C | N/A | Orchestration layer, not SDK |
| D. Observe task state | 3.1.D | Done | `status.ts` — `getWorktreeStatus`; `worktree.ts` — `branchExists` |
| E. Commit results | 3.1.E | Done | `commit.ts` — `commitChanges` (staging policies) |
| F. Verify results | 3.1.F | Skipped | User decision: no verify command |
| G. Merge results | 3.1.G | Done | `merge.ts` — `mergeWorktree` (ff-only/squash); `rebase.ts` — `rebaseOntoTarget` |
| H. Safe cleanup | 3.2.H | Done | `worktree.ts` — `removeWorktree` (dirty check, force flag) |
| I. Copy ignored files | 3.2.I | Done | `copy-ignored.ts` — `copyIgnored` (pattern filter) |
| J. Default branch discovery | 3.2.J | Done | `default-branch.ts` — `getDefaultBranch` |
| K. Structured status API | 3.2.K | Partial | `getWorktreeStatus` returns structured data, no `--json` CLI |

---

## 11. References

[^overview]: Worktrunk overview: https://worktrunk.dev/

[^switch]: `wt switch` docs: https://worktrunk.dev/switch/

[^list]: `wt list` docs: https://worktrunk.dev/list/

[^merge]: `wt merge` docs: https://worktrunk.dev/merge/

[^hook]: `wt hook` docs: https://worktrunk.dev/hook/

[^step]: `wt step` docs: https://worktrunk.dev/step/

[^config]: `wt config` docs: https://worktrunk.dev/config/

[^faq]: Worktrunk FAQ: https://worktrunk.dev/faq/

[^llm]: LLM commit docs: https://worktrunk.dev/llm-commits/

[^claude]: Claude Code integration docs: https://worktrunk.dev/claude-code/

[^docsrs]: crate docs (`worktrunk`): https://docs.rs/worktrunk

[^video]: YouTube metadata page for the linked video, titled “Solving one of Git's biggest weaknesses.”: https://www.youtube.com/watch?v=WBQiqr6LevQ
