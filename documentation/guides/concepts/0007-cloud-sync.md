# Cloud sync

Keep project data in sync between your computers. Cloud access is available to accounts with early access.

## Sign in

Open the Cloud status item in the status bar, then choose **Cloud settings**. Choose **Sign in** and finish signing in in the browser. You can close and reopen settings while sign-in is pending, or choose **Cancel sign-in** to cancel it.

If the status says **Sign in again**, open Cloud settings and sign in again. An account without early access shows **Coming soon** and does not show device or project sync controls.

## Sync a project

Open the project, then open Cloud settings from its status item. Choose **Sync with Cloud**. Wait for **Synced** before relying on another computer's copy.

The status describes this project's current state:

| Status | Meaning |
| --- | --- |
| Local | This project is not syncing. |
| Offline | The connection is lost. Local work remains available. |
| Downloading | The first download is in progress. A percentage appears when known. |
| Syncing | Changes are waiting to sync. |
| Synced | This device has finished its current sync work. |
| Needs attention | Open the status item for the problem and recovery action. |

Cloud synchronizes project data used by your tools. It does not provide a complete backup of your local project folder. See [restore project data](0006-restore-project-data.md) for local recovery points.

## Manage devices

Cloud settings lists your devices when early access is enabled. Choose **Rename**, enter a name and choose **Save**. Choose **Remove** to remove a device from the account. The current computer is marked **This device**.

## Make a project local

In Cloud settings, choose **Make local** and confirm. Syncing stops on every device, and each device keeps its copy.

Choose **Sync with Cloud** to enable syncing again. The copies merge. Where both copies changed the same thing, one change is kept.
