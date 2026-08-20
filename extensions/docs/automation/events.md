# Extension Events

Extension events carry lifecycle payloads after Prompt Studio state changes.

Common event groups:

- ticket events
- worktree events
- attempt status events
- session lifecycle events

Use events for follow-up work that should not block the initiating request. Use command middleware when the automation needs to reject a transition.
