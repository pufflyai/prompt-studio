# Restore project data

Use a recovery point on your device to recover cloud project data after an accidental deletion or unwanted edit.

## Choose a recovery point

Open **Settings → Project → Recovery**. Choose a recovery point, then select
**Whole project** or one extension. Check its capture time and select **Restore**.
The restored data is saved locally and syncs to your other devices through normal sync.

Each device keeps at most three points for each cloud project: one for the last hour,
one for the last 12 hours, and one for the last day. Capture runs while the device is
running. A new cloud project must finish its first download before its first capture.
Existing recovery points keep rotating offline, including after a restart. Nothing is
captured while the device is off, so always check a point's actual capture time.

Recovery uses the free disk space without a fixed quota or free-space reserve.
When the space cannot hold every point, only the 12-hour point is kept. If the disk
cannot hold even that point, new captures fail and saved project data stays intact.

## Use the CLI

Agents and scripts use the same restore as the product. List the recovery points:

```sh
pst projects recovery-points <project-id>
```

Copy a point's `hours` and exact `capturedAt` into the restore command:

```sh
pst projects restore <project-id> --hours 12 --captured-at <capture-time>
pst projects restore <project-id> --hours 12 --captured-at <capture-time> --extension-id <extension-id>
```

If a point was replaced before you restore, list the points again and choose again.

## What changes

A restore writes the difference between the current data and the selected point as
normal record edits. It brings back deleted records and text, and removes records added
after that point. Restoring one extension leaves other extensions unchanged.

Before it writes, the restore saves the current state in the hour point, or in the
12-hour point when there is no hour point. Choose that point to undo the restore. A
project still never has more than three points.

A recovery point holds each extension's records, asset references, text documents and
data migration markers. It does not back up your Git checkout, local workspace folders,
credentials, account access or private session history. Project resource numbers stay
unchanged. Asset bytes that a restored record refers to must still be available on the
device. The relay keeps no recovery history. Removing an extension's data also removes it
from the recovery points.
