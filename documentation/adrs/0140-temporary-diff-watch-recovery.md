# Temporary recovery for bounded workspace diff watches

Proposed: 2026-11-09
Status: Proposed; PS-157 qualification is in progress.

## Decision

Observe local diff-capable workspaces only while their summaries are observed. Share a filesystem/Git watch per workspace and carry logical observations on the existing shared client stream. Summary reads share a four-request runtime admission limit and the scoped query lifecycle.

## External limitation

The existing cross-platform directory watcher uses one operating-system handle per directory on Linux. An unrestricted traversal can exhaust a process's watch budget. Limit a workspace observation to 2,000 directories: up to 1,800 working directories and 100 each for worktree metadata and shared Git metadata, excluding Git object and log storage. Native recursive watches still filter those events. Git worktree metadata and shared refs have their own bounded observations because linked worktrees keep them outside the working folder.

If the directory limit is reached or a watch fails, retain a single 30-second recovery hint for that observed workspace. The hint invalidates its summary; it does not run Git or read documents on its own. Normal watches have no periodic summary refresh. The last observer cancels the watch and recovery timer. Reopening retries watch setup and catches up before accepting a summary. Transport reconnect recovery belongs to the active observation and uses bounded backoff, without another physical event connection.

## Owner and removal

The workspace diff observation owns this recovery path. Tests must cover the cap, gap-only timer, shared ownership and cancellation. Remove the timed hint when the supported watcher can guarantee complete coverage within an explicit resource bound on every supported platform. Until then, recorded production measurements must include limited-watch recovery and inactive workspaces must remain quiet.
