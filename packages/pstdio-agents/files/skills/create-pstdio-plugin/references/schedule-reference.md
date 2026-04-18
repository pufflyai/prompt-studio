# Schedule (Cron) Reference

Schedules are declared via `definePlugin({ schedules: [...] })`.

## Schedule Shape

```ts
type ScheduleDefinition = {
  name: string;
  cron: string;
  timeoutSeconds?: number; // default 60
  trigger: (ctx: ScheduledTriggerContext) => void | Promise<void>;
};
```

## Trigger Context

```ts
type ScheduledTriggerContext = {
  type: "schedule";
  scheduleName: string;
  scheduledFor: string; // ISO timestamp
  runId: string;
  client: PstdioClient;
  projectId: string;
};
```

## Cron Format

- 5 fields: `minute hour day month weekday`
- UTC evaluation
- Accepted syntax: wildcard (`*`), range (`1-5`), list (`1,3,5`), step (`*/15`)

Examples:

- `0 * * * *` — every hour
- `*/5 * * * *` — every 5 minutes
- `0 9 * * 1-5` — 09:00 UTC weekdays

## Runtime Semantics

- Overlap protection: if previous run is active, next run is skipped (`skipped_overlap`)
- Timeout handling: runs over `timeoutSeconds` are marked timed out (`timed_out`)
- Failure isolation: handler errors are logged (`handler_error`) and do not crash scheduler
- Graceful shutdown: scheduler stops and waits for in-flight runs (bounded wait)

## Validation

- Use `definePlugin(...)` for early validation.
- If schedule files are added/changed, run `pstdio plugins register` to refresh plugin runtime cache.

## Known Issue

- Cron validation currently exists in both SDK and loader paths; keep behavior aligned when changing either.
