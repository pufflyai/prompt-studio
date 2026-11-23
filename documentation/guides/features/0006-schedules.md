# Schedules

A schedule gives repeated work a time to run, such as a morning brief, a weekly report, or a regular check.

## What schedules give you

A schedule runs one of a tool's commands at set times. The command does the same work it does when you run it yourself, so a scheduled report and a report you start by hand use the same code and save the same kind of result.

The dashboard calls schedules automations.

## Use schedules in Prompt Studio

Each automation can be turned on or off per project. Use the automation dropdown in the **Extensions** list, or open the extension's page and find it under automations. Automations are on by default unless the tool ships them turned off, and your choice always wins over that default. The scheduler skips automations that are off.

### Cloud projects

In a project synced through Cloud, assign each automation to one device. Only that device runs it; the other devices keep its definition but never run it. An unassigned automation stays idle.

```sh
pst extensions automations assign acme.clock.schedule.tick \
  --device-id device-id --project-id project-id
pst extensions automations list --project-id project-id
pst extensions automations runs --project-id project-id
```

Find device IDs with `pst devices list`. An assignment cannot be changed, and there is no fallback when the device is off or offline. Missed runs are recorded as `skipped` when the device starts again; they do not run late.

## Add a schedule to your tool

Bind a command to a cron expression with `defineSchedule`, then list it in `defineExtension({ schedules })`:

```ts
import { defineCommand, defineExtension, defineSchedule } from "@pstdio/sdk/extensions";

const writeReport = defineCommand({
  id: "write-report",
  title: "Write report",
  async run(ctx) {
    await ctx.storage.set("lastReportAt", new Date().toISOString());
  },
});

const nightlyReport = defineSchedule({
  id: "nightly-report",
  title: "Nightly report",
  schedule: "0 2 * * *",
  command: writeReport.ref,
});

export default defineExtension({ commands: [writeReport], schedules: [nightlyReport] });
```

In cron syntax, `0 2 * * *` means minute 0 of hour 2, every day. A schedule can also pass `params` to the command. Set `disabled: true` to ship the automation turned off.

A scheduled command often writes only to storage. Add a read command if you want to see its results from `pst`. For work that takes longer than one request, have the command start a durable run with `ctx.automation.enqueue`.

If a schedule is missing under automations, check that it is listed in `schedules` and that `pst extensions check` reports no errors.

## Learn more

- [Automation cookbook](../extensions/0003-automation.md#run-a-command-on-a-schedule) has the complete example.
- [Lifecycle automation](../../references/extensions/0006-lifecycle-automation.md#schedules-and-durable-work) explains schedules and durable work.
- [Scheduled automations](../../references/cli/0010-scheduled-automations.md) covers device assignment in Cloud projects.
- [Durable work](../../references/extensions/0007-durable-automation.md) explains long-running runs.

*Updated at: 2026-11-22*
