# Hooks Reference

Hooks are user-defined scripts in `.pstdio/hooks/<hook-name>` that run during worktree, session, and ticket lifecycle events.

This reference defines the hook contract used by `pstdio`: names, blocking behavior, stdin/stdout protocol, environment variables, payload schemas, and cookbook examples.

## Reference Pages

- [Events and Blocking](./events.md)
- [Interface and Environment](./interface.md)
- [Payload Schemas](./payloads.md)
- [Attempt Status](./attempt-status.md)
- [Cookbook](./cookbook.md)

## Related Docs

- [CLI Lifecycle Hooks](../cli/hooks.md)
- [Attempt Status Hooks (Draft)](./attempt-status-hooks-draft.md)
- [Hook Lifecycle Logging (Draft)](./lifecycle-logging.md)
