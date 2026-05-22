# Lifecycle Automation

Lifecycle automation is handled by extensions. The legacy SDK plugin hook system has been removed.

Use:

- extension command middleware for blocking checks
- extension event handlers for follow-up automation
- extension commands for user-triggered workflow actions

The default automation is provided by:

- `pstdio-core-ticket-automations`
- `pstdio-core-workspace-automations`
- `pstdio-core-worktree-automation`

See [Extensions](../sdk/plugins.md) for the current authoring surface.
