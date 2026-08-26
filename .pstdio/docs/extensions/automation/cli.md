# Lifecycle Automation

Prompt Studio lifecycle automation is provided by extensions:

- Blocking lifecycle behavior should be implemented with extension command middleware.
- Non-blocking lifecycle behavior should be implemented with extension event handlers.
- User-triggered workflow actions should be implemented as extension commands.

## Built-In Automation Extensions

Prompt Studio ships default automation through first-party extensions:

| Extension | Purpose |
| --------- | ------- |
| `pstdio-planner` | Managed ticket attempts, dependency readiness, review history, templates, skills, and ticket-aware workspace provisioning. |

## Extension Surfaces

Use extension command middleware for operations that may reject a command before it commits state. Use extension event handlers for lifecycle work that should run after state changes.

Common lifecycle events include:

- ticket created, updated, archived, and deleted
- worktree created
- session started, resumed, completed, failed, or awaiting input

See the SDK extension types for the current event and middleware contracts.
