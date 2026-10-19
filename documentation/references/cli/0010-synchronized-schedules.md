# Synchronized schedules

Assign a shared schedule to one environment and inspect whether changes have reached that target.

These commands use the selected local runtime and a linked workbench. They require
a build with synchronized automation support. Publishing a schedule does not assign
it or run it on every connected environment.

Publish the extension through `pst extensions publication`. On the environment that
should run the schedule, choose its full schedule ID and an existing local workspace:

```sh
pst extensions automations assign example.clock.schedule.tick --workspace-id workspace-id
pst extensions automations list
```

The saved target contains the environment, workbench, and workspace IDs. There is
no fallback, retargeting, handoff, or hosted execution. An unassigned shared schedule
stays idle. If its target is asleep or its workspace is unavailable, other runtimes
do not take over.

Use the `revision` from `list` to change the shared schedule:

```sh
pst extensions automations disable example.clock.schedule.tick --expected-revision observed-revision
pst extensions automations enable example.clock.schedule.tick --expected-revision observed-revision
```

`delivery: pending` means the reader has not received an acknowledgment for that
exact choice from its target. It remains pending while the target is offline,
even after the relay accepts the change. `applied` means the target applied its
admission rule. It does not mean a command finished or the target remains online.
The whole-extension publication switch also disables its schedules.

After applying a disable, the target starts no new dispatches. Active work keeps
running. A later enable waits for its next live occurrence. Missed occurrences are
recorded as skipped and never run as catch-up.

Inspect the selected runtime's history:

```sh
pst extensions automations runs
```

Each occurrence has a stable run ID. Duplicate delivery and restart cannot dispatch
that occurrence again. A retained `started` occurrence after a crash has an unknown
completion result and is not retried automatically. Sessions, processes, credentials,
folders and run history stay local. Only definitions and application acknowledgments
synchronize.

All commands accept `--project-id` to choose a workbench explicitly. Assignment must
run on its target runtime with `--workspace-id`. Other switch commands can run from
any connected environment. Run `pst extensions automations --help` to inspect the
options supported by your installed version.
