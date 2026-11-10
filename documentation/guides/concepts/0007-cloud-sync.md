# Cloud sync

Keep project data in sync between your computers. Cloud access is available to accounts with early access.

## Sign in

Install **Prompt Studio Cloud** from **Extensions**.

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
| Needs attention | Open Cloud settings to check the account and project state. |

Cloud synchronizes project data used by your tools. If the project folder has a `.pstignore` file at its root, each computer also uploads an encrypted copy of that folder, which another of your computers can restore; see [restore a project folder](#restore-a-project-folder-on-another-computer). See [restore project data](0006-restore-project-data.md) for local recovery points of project data.

## Restore a project folder on another computer

On macOS and Linux, each computer whose synced project folder has a `.pstignore` file at its root captures it and uploads an encrypted copy. A folder without one is not copied: its tools' data already syncs, and its code can come from its Git host. Add an empty `.pstignore` to copy everything. Only your own computers can read it; other members of a shared project cannot. Your other computers download every completed copy automatically, so a copy can be restored while the computer that made it is off. You do not need a Git host, a commit or a push.

A copy includes every file and folder in the project folder, including hidden files, `.env` files, build output and the whole `.git` folder with unpushed commits, staged changes, branches, reflogs and local Git settings. `.gitignore` does not apply. Only the root `.pstignore` file excludes paths; add `node_modules/` to skip dependencies. Deleting `.pstignore` stops new copies, and earlier copies stay restorable. It uses `.gitignore` patterns: `#` comments, `*`, `?` and `**`, a leading `/` for paths from the root, a trailing `/` for folders, and `!` to include a path again. Symlinks are saved as links with their target text and are never followed. A file that keeps changing or cannot be read is never skipped: the new copy stays pending and the previous copy stays restorable.

Restore with the CLI. The app has no restore screen yet.

```sh
pst projects folder sources <project-id>
pst projects folder restore <project-id> --device <device-id> --source <source-id> --path <new-folder>
```

`sources` lists each computer's copy with its capture time, size, `.pstignore`, Git state and whether every byte is already on this computer. Restore into a folder that does not exist yet. Its parent folder must exist. The folder appears only after every file has been verified. If the project has no folder on this computer yet, the restored folder becomes its folder; otherwise it stays beside the current one. Restore a copy before you open the project, because opening it creates an empty project folder. A restored folder's hooks, scripts and automations do not run, and extensions in its `.pstdio/extensions` folder stay disabled until you enable them. Restored files keep their permission bits but not setuid, setgid or sticky bits.

Cloud keeps each computer's latest complete copy, plus the previous one during the relay's grace period. Folder copies are not part of recovery points. Windows and musl-based Linux cannot capture or restore folders yet.

## Manage devices

Cloud settings lists your devices when early access is enabled. Choose **Rename**, enter a name and choose **Save**. Choose **Remove** to remove a device from the account. The current computer is marked **This device**.

## Make a project local

In Cloud settings, choose **Make local** and confirm. Syncing stops on this device immediately. Other devices discover the change when they refresh account membership; an idle device may take up to a minute. Each device keeps its copy.

Choose **Sync with Cloud** to enable syncing again. The copies merge. Where both copies changed the same thing, one change is kept.

*Updated at: 2026-11-07*
