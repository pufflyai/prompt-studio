---
name: create-pstdio-plugin
description: "Create or edit pstdio plugins in .pstdio/plugins, including lifecycle hooks and cron schedules."
metadata:
  - version: 0.0.1
---

## Workflow

1. Confirm the plugin target is under `.pstdio/plugins/`.
2. Choose plugin type:
   - **Lifecycle hook plugin** (TypeScript/JavaScript via `definePlugin({ hooks: ... })`)
   - **Scheduled plugin** (TypeScript/JavaScript via `definePlugin({ schedules: ... })`)
   - **Git-level shell hook** (`pstdio hooks create <hook-name>` for shell scripts)
3. Implement the smallest plugin needed for the requested behavior.
4. Validate:
   - `pstdio hooks list` (if hook-related)
   - `pstdio plugins list`
   - `pstdio plugins register` when plugin files changed and cache refresh is needed
5. Run project validation when required (`bun run validate`) and save ticket artifacts.

## Lifecycle Hook Plugins

Write lifecycle hooks with `definePlugin` and a `hooks` object.

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  hooks: {
    async postTicketCreation(ctx) {
      // side-effect logic
    },
  },
});
```

Blocking behavior:

- For blocking hooks (`pre-*`), return `{ reject: true, reason: "..." }` to abort.
- Non-blocking hooks should log/handle errors and continue.

## Cron / Scheduled Plugins

Use `schedules` for recurring automation.

- Cron format: 5 fields (`minute hour day month weekday`) in UTC.
- Required schedule fields: `name`, `cron`, `trigger`.
- Optional: `timeoutSeconds` (default 60).

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  schedules: [
    {
      name: "hourly-health-check",
      cron: "0 * * * *",
      timeoutSeconds: 30,
      async trigger(ctx) {
        console.log(
          `[scheduled] project=${ctx.projectId} schedule=${ctx.scheduleName} runId=${ctx.runId} at=${ctx.scheduledFor}`,
        );
      },
    },
  ],
});
```

Schedule trigger context includes `type`, `scheduleName`, `scheduledFor`, `runId`, `client`, and `projectId`.

Runtime behavior:

- UTC cron evaluation
- overlap protection (`skipped_overlap`)
- timeout handling (`timed_out`)
- handler error isolation (`handler_error`)

## Rules

- Keep plugin logic focused; avoid speculative abstractions.
- Prefer typed SDK plugin handlers when possible.
- Guard shell-hook env vars; not all vars are present on every hook.
- Hook timeout is 60 seconds.

## References

- [references/hook-reference.md](references/hook-reference.md) — complete hook catalog and blocking behavior.
- [references/schedule-reference.md](references/schedule-reference.md) — schedule fields, cron semantics, runtime behavior.
- [references/action-reference.md](references/action-reference.md) — action schema, params, and trigger context.
- [references/examples.md](references/examples.md) — practical examples for hooks, schedules, and actions.
