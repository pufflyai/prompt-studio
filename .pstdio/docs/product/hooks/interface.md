# Plugin Hook Interface

> All hooks are SDK plugins defined via `definePlugin` in `.pstdio/plugins/`. See the [SDK Plugins docs](../sdk/plugins.md).

## Hook Location

Hooks are TypeScript/JavaScript modules stored at:

- `.pstdio/plugins/<plugin-name>.ts`

A single plugin file can define multiple hooks.

## Input and Output Contract

All hooks receive a typed context object via their handler function.

### Pre-hooks

Pre-hooks can block the parent operation by returning a rejection:

```ts
hooks: {
  preTicketCreation(ctx) {
    if (!ctx.user_prompt) {
      return { reject: true, reason: "Missing description" };
    }
  }
}
```

Pre-hooks can also return payload overrides via `data`:

```ts
hooks: {
  preTicketCreation(ctx) {
    return { data: { priority: "medium" } };
  }
}
```

Rules:

- Returning `undefined` or `{}` means accept.
- Returning `{ reject: true }` blocks the operation.
- Returning `{ data: { ... } }` merges overrides into the payload.
- Throwing an error is treated as a rejection with the error message as the reason.

### Post-hooks

Post-hooks run after the operation completes. They cannot block or modify the result.

```ts
hooks: {
  postTicketCreation(ctx) {
    // fire-and-forget side effects
  }
}
```

Post-hooks run concurrently and swallow errors silently.

## Payload Modification Semantics

- Pre-hooks: `data` overrides are applied before the operation executes.
- Post-hooks: return values are ignored.

Each hook invocation is independent.

## Session Correlation Note (attempt status)

`session_id` is the correlation key used for session-bound attempt-status post hooks.

Post-hook delivery rules:

1. With `session_id`: post hook delivery is deferred to session termination.
2. Without `session_id`: post hook runs immediately after the status update is committed.

In concurrent workflows, pass the session id explicitly:

```sh
pstdio workspaces set-status --workspace "PS-1_A1" --status review-ready --session-id "session_123"
```
