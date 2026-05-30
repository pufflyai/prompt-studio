# Lifecycle Automation

Prompt Studio lifecycle automation is provided by extensions:

- Blocking lifecycle behavior should be implemented with extension command middleware.
- Non-blocking lifecycle behavior should be implemented with extension event handlers.
- User-triggered workflow actions should be implemented as extension commands.

## Built-In Automation Extensions

Prompt Studio ships default automation through first-party extensions:

| Extension | Purpose |
| --------- | ------- |
| `pstdio-core-tickets` | Ticket and attempt workflow commands plus ticket lifecycle automation. |
| `pstdio-core-workspace-automations` | Workspace-scoped commands such as review-session creation. |
| `pstdio-core-worktree-automation` | Worktree bootstrap automation. |

## Extension Surfaces

Use extension command middleware for operations that may reject a command before it commits state. Use extension event handlers for lifecycle work that should run after state changes.

Common lifecycle events include:

- ticket created, updated, archived, and deleted
- worktree created
- attempt status changed
- session started, resumed, completed, failed, or awaiting input

See the SDK extension types for the current event and middleware contracts.
