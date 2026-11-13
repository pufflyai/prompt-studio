# Temporary recovery for bounded workspace diff watches

Proposed: 2026-11-09
Status: Proposed; PS-157 qualification is in progress.

## Decision

Observe local diff-capable workspaces only while their summaries are observed. Share a filesystem/Git watch per workspace and carry logical observations on the existing shared client stream. Summary reads share a three-request runtime admission limit and the scoped query lifecycle. Alongside the two event streams, this leaves one HTTP/1.1 connection for opening documents and other required reads instead of queuing them behind optional totals.

## External limitation

The existing cross-platform directory watcher uses one operating-system handle per directory on Linux. An unrestricted traversal can exhaust a process's watch budget. Limit a workspace observation to 2,000 directories: up to 1,800 working directories and 100 each for worktree metadata and shared Git metadata, excluding Git object and log storage. Native recursive watches still filter those events. Git worktree metadata and shared refs have their own bounded observations because linked worktrees keep them outside the working folder.

If the directory limit is reached or a watch fails, retain a single 30-second recovery hint for that observed workspace. The hint invalidates its summary; it does not run Git or read documents on its own. Normal watches have no periodic summary refresh. The last observer cancels the watch and recovery timer. Reopening retries watch setup and catches up before accepting a summary. Transport reconnect recovery belongs to the active observation and uses bounded backoff, without another physical event connection.

macOS FSEvents can drop writes immediately after `fs.watch` returns, and its public API exposes no readiness or history-coverage barrier. The pinned Bun runtime's existing directory-watcher fixtures use a 100 ms startup grace. The original recovery hint ran after that grace and a normal 100 ms change batch, invalidating the initial finite read around 200 ms after watch construction. Each new macOS workspace observation now defers admission of that first read until the same 200 ms window ends. The initial snapshot covers silent startup edits without an unconditional second read. Hints received during admission are covered by that snapshot; subsequent hints and gap-only recovery remain authoritative. Cancelling the final observer releases the native watches and startup timer, including while admission is pending.

This moves the existing reconciliation window ahead of the first snapshot and therefore adds up to 200 ms to initial macOS watch admission. It neither changes the performance budgets nor establishes native readiness: the grace remains a measured workaround, and the adapter needs a real registration/history coverage barrier to remove that limitation.

## Owner and removal

The workspace diff observation owns this recovery path. Tests must cover the cap, gap-only timer, shared ownership and cancellation. Remove the startup reconciliation when the native adapter exposes a registration/history coverage barrier. Remove the timed recovery hint when the supported watcher can guarantee complete coverage within an explicit resource bound on every supported platform. Until then, recorded production measurements must include limited-watch recovery and inactive workspaces must remain quiet.
