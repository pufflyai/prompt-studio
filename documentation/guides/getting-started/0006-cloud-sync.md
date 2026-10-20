# Cloud sync

Sign in once on each computer to sync Cloud projects. Your saved work stays available locally when the connection drops.

## Sign in and manage devices

Open **Settings → Account and devices**, then choose **Continue with Google**. Finish sign-in in the browser on the computer running Prompt Studio. If the browser does not open, use **Open Google sign-in**. Cancel and retry without closing your project or losing your open draft.

The account page shows your signed-in email and devices. Each device has its name, platform and last-seen time. Each signed-in runtime sends an authenticated heartbeat every 15 seconds, including when it has no Cloud projects. Online means the account service heard from that device in the last 45 seconds. A disconnected or stopped device becomes Offline after that window. If the account service cannot be reached, online status is unavailable.

Choose **Rename** to change a device name. **Remove** stops that device from renewing Cloud access. It keeps downloaded data. **Sign out** stops sync on this device and keeps local data and open work. If the service is unreachable, sign-out still works locally; remove the device from another computer later.

If sign-in is unavailable, the runtime has no account service configured. Ask the person who operates it to enable Cloud sign-in.

## Choose which projects sync

Open a project and go to **Settings → Project sync**. Turn on **Sync this project with Cloud**. Devices signed in to the same account sync this project when it exists on them. Local-only projects stay independent.

Turning the switch off stops sync for this project on every device. Each device keeps its local copy. The switch stays unavailable while the account service has not confirmed the project's current setting.

## Read the project status

The trailing end of the status bar shows the selected project's status. Select it for details or to check again.

| Status | Meaning |
| --- | --- |
| Saved locally | Saved changes are on this device. The project is local only. |
| Waiting to sync | Saved local changes have not reached Cloud yet, or sync is still running. |
| Synced | All known documents and required files have downloaded, and saved changes have reached Cloud. |
| Offline | The Cloud connection is unavailable. Continue working locally. Sync retries automatically. |
| First download incomplete | Some documents or files are missing locally. The project is **not ready offline**. Download resumes when the connection returns. |
| Needs attention | Some encrypted data could not be read. Healthy updates continue. Check the account and service, then retry. |

An incomplete download stays incomplete even when the network goes offline. A connection alone does not mean the project has finished downloading. Status describes saved project data; keep an open editor's draft until its save finishes.

For command-line and SDK access, see [Log in and sync Cloud projects](../sdk/0004-device-login.md).
