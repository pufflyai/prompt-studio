# Restore project data

Use a recovery point on your device to recover cloud project data after an accidental deletion or unwanted edit.

## Choose a recovery point

Open **Settings → Project → Recovery**. Choose a recovery point, then select
**Whole project** or one extension. Check its capture time and select **Restore**.
The restored data is saved locally and syncs to your other devices through normal sync.

Each device keeps at most three points: one captured hourly, one every 12 hours,
and one daily. Capture runs while the device is running. A new cloud project must
finish its first sync before its first capture. Existing recovery points continue
rotating offline, including after restarting the runtime. There are no captures
while the device is off, and missed captures are not invented. Always check the
actual capture time rather than assuming a point is exactly an hour or a day old.

Recovery uses available disk space without a fixed quota or free-space reserve.
When space is insufficient, only the 12-hour point is kept. If the disk cannot
hold even that point, new captures fail while saved project data stays intact.

## Use the CLI

List the available recovery points:

```sh
pst projects snapshots <project-id>
```

Copy a point's `hours` and exact `capturedAt` into the restore command:

```sh
pst projects restore <project-id> --hours 12 --captured-at <capture-time>
pst projects restore <project-id> --hours 12 --captured-at <capture-time> --extension-id <extension-id>
```

If a point changes before you restore, refresh the list and select it again.
The product and CLI use the same restore API and permissions.

## What changes

A restore writes the difference between current content and the selected point
as a new edit. It can bring back deleted records and text, and remove data added
after that point. Restoring one extension leaves other extensions unchanged.
The current state replaces one existing recovery slot before the restore commits,
so you can choose that point to undo the restore without keeping a fourth snapshot.
If this safety write fails, no project data changes.

Recovery points contain extension records, asset references, and declared shared
text documents. They do not back up your Git checkout, local workspace folders,
credentials, account access, or private session history. Project resource identities
and their assigned numbers also stay unchanged. Referenced asset bytes must still be available
on the device or through normal sync. The relay keeps no recovery history.
Explicitly removing an extension's data also removes it from local recovery points.
