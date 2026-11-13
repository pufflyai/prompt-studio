# Temporary recovery for bounded workspace watches

Proposed: 2026-11-09
Status: Proposed; PS-157 qualification is in progress.

## Decision

Observe local diff-capable workspaces only while their summaries are observed. Share a filesystem/Git watch per workspace and carry logical observations on the existing shared client stream. Summary reads share a four-request runtime admission limit and the scoped query lifecycle.

## External limitation

The existing cross-platform directory watcher uses one operating-system handle per directory on Linux. An unrestricted traversal can exhaust a process's watch budget. Limit a workspace observation to 2,000 directories: up to 1,800 working directories and 100 each for worktree metadata and shared Git metadata, excluding Git object and log storage. Native recursive watches still filter those events. Git worktree metadata and shared refs have their own bounded observations because linked worktrees keep them outside the working folder.

If the directory limit is reached or a watch fails, retain a single 30-second recovery hint for that observed workspace. The hint invalidates its summary; it does not run Git or read documents on its own. Normal watches have no periodic summary refresh. The last observer cancels the watch and recovery timer. Reopening retries watch setup and catches up before accepting a summary. Transport reconnect recovery belongs to the active observation and uses bounded backoff, without another physical event connection.

macOS FSEvents can drop writes immediately after `fs.watch` returns, and its public API exposes no readiness or history-coverage barrier. The pinned Bun runtime's existing directory-watcher fixtures use a 100 ms startup grace. Each new macOS workspace observation therefore owns one reconciliation hint after that grace, coalesced through its normal 100 ms change batch. This catches up the initial finite read without delaying watch admission or adding an interval. The final observer cancels both timers. The grace is a measured workaround, not a guarantee of native registration readiness; the adapter needs a real coverage barrier to remove that limitation.

## File explorer observations

The same operating-system limits apply to a presented workspace file explorer, including non-Git project folders. Its host-owned observation uses the existing shared client stream and at most 2,000 directory handles, excluding `.git`. It coalesces change hints, owns the same native-startup reconciliation and gap-only 30-second recovery hint, and cancels all handles and timers when the last observer leaves. These hints invalidate tree reads; they do not read files or replace editor content.

## Owner and removal

The workspace diff observation owns this recovery path. Tests must cover the cap, gap-only timer, shared ownership and cancellation. Remove the startup reconciliation when the native adapter exposes a registration/history coverage barrier. Remove the timed recovery hint when the supported watcher can guarantee complete coverage within an explicit resource bound on every supported platform. Until then, recorded production measurements must include limited-watch recovery and inactive workspaces must remain quiet.
