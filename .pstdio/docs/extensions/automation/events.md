# Extension Events

Extension events carry lifecycle payloads after Prompt Studio state changes.

Common event groups:

- `projectEvents`, `workspaceEvents`, and `worktreeEvents`
- `sessionEvents` and `gitEvents`
- command lifecycle events created with `commandEvent(commandRef, phase)`

Use `defineHook({ id, event, run })` and register hooks in an array. Ticket and
attempt state belong to the Planner extension. Integrate through its commands
and published events instead of core ticket or attempt-status events.

Use events for follow-up work that should not block the initiating request. Use command middleware when the automation needs to reject a transition.
