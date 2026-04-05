# Hooks Reference

Hooks let you run custom logic in response to lifecycle events.

**SDK plugins** are the hook mechanism — TypeScript or JavaScript handlers defined via `definePlugin` in `.pstdio/plugins/`. See the [SDK Plugins docs](../sdk/plugins.md).

This reference covers event names, blocking behavior, payload schemas, and cookbook examples.

## Reference Pages

- [Events and Blocking](./events.md)
- [Interface and Environment](./interface.md) — hook contract
- [Payload Schemas](./payloads.md)
- [Attempt Status](./attempt-status.md)
- [Cookbook](./cookbook.md)

## Related Docs

- [SDK Plugins](../sdk/plugins.md)
- [CLI Lifecycle Hooks](../cli/hooks.md)
- [Attempt Status Hooks (Draft)](./attempt-status-hooks-draft.md)
- [Hook Lifecycle Logging (Draft)](./lifecycle-logging.md)
