---
layout: ../../../layouts/docs-layout.astro
title: Use schedules
description: Run background plugin handlers on a cron schedule.
htmlTitle: Use schedules
htmlDescription: Run plugin handlers on a cron schedule from inside Prompt Studio.
section: Guide
category: Automation
categoryOrder: 5
order: 5
---

## Define a schedule

Plugins can declare schedules on the `schedules` array:

```ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  key: "digest",
  schedules: [
    {
      name: "weekly-digest",
      cron: "0 9 * * MON",         // every Monday at 09:00
      timeoutMs: 60_000,
      handler: async (ctx) => {
        const projects = await ctx.client.projects.list();
        console.log(`[digest] scanning ${projects.length} projects`);
      },
    },
  ],
});
```

## Schedule shape

```ts
type ScheduleDefinition = {
  name: string;          // unique within the plugin
  cron: string;          // standard 5-field cron
  timeoutMs?: number;    // kill the handler after this long
  handler: (ctx: ScheduledTriggerContext) => void | Promise<void>;
};
```

## Handler context

```ts
type ScheduledTriggerContext = {
  client: PstdioClient;
  projectId: string;
  trigger: { type: "schedule" };
  scheduleName: string;
  scheduledFor: string;  // ISO timestamp of the intended run
  runId: string;         // unique id per run
};
```

## When the schedule runs

Schedules run while the local API is running — either because `pstdio` or `pstdio serve` is running, or a separate service is keeping the API alive. They do not run when the API is offline.

If `timeoutMs` is hit, the handler is aborted and the run is marked as failed.

## Failures

Handler exceptions are logged against the schedule's `runId`. A later run does not re-fire the missed one; cron catches up only with the next normal tick.

## Register a plugin with schedules

```bash
pstdio plugins register
```

Schedules appear under **Settings → Plugins** with their cron expression and next-run timestamp.

## Related pages

- [`definePlugin` reference](/docs/reference/sdk/plugins/).
- [Use hooks](/docs/automation/hooks/) — for event-driven handlers.
- [Add project plugins](/docs/customization/add-plugins/) — how plugins are loaded.
