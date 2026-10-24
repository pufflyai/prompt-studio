# Scheduled automations

Assign a cloud project's automation to one device. Other devices keep its definition but never run it.

## Assign a device

Find device IDs with `pst devices list`. Use the full schedule ID declared by the
extension, such as `acme.clock.schedule.tick`:

```sh
pst extensions automations assign acme.clock.schedule.tick \
  --device-id device-id --project-id project-id
pst extensions automations list --project-id project-id
```

An assignment is saved locally and syncs with the project's other records. It cannot
be reassigned. Concurrent first assignments merge by the same rules as other project
fields; after sync every device reads the same assigned device. There is no fallback
when that device is off, offline, removed, or lacks the extension or required workspace.

An unassigned cloud schedule stays idle, including during the first download. A local
project keeps its normal schedule behavior. An existing assignment remains enforced
when a project becomes local or the device logs out.

## Missed runs and switches

The assigned device records missed occurrences as `skipped` when it starts again or
receives its next schedule callback. It resumes at the next live occurrence instead
of running missed work. Inspect that device's local history:

```sh
pst extensions automations runs --project-id project-id
```

Occurrence IDs stay stable across duplicate sync delivery and restart. A claim is
saved before the command runs. A claim left `started` after a crash is not replayed;
it does not prove that external work completed.

The normal automation switch changes the synced definition once it has an assignment.
A disable stops new dispatches when the device receives it. Active work can finish.
An offline device receives the edit through normal project sync when it reconnects.
There is no separate pending-disable delivery service.
