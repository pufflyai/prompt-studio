# Prompt Studio Cloud

The status widget shows connection loss, download progress, and local project preparation. Opening a Cloud project keeps navigation available while its folder is prepared in the background. Setup failures stay visible in Cloud details and the status bar.

The optional Cloud extension shows account and project sync status in the status bar.
Install **Prompt Studio Cloud** from **Extensions**.
Open it for details, then choose **Cloud settings** to sign in, manage your devices,
or make this project local. Making a project local stops syncing on every device;
each keeps its copy. Syncing again merges those copies.

Open **Settings → Team** to create or join a team, inspect its members, and invite
someone with a single-use desktop code. Owners remove members through the row's
trash action. Joining does not grant project access; assigned project members manage
access in the project's Cloud settings. Team actions include ownership transfer and
leaving a team.

In **Settings → Managed extensions**, the owner selects an installed tool from the
current project. Its verified package becomes required in every authorized team
project and on newly joined devices. Members see the policy read-only. Clear the
checkbox to restore ordinary control while keeping the tool installed. Use **Update
from this project** to select a newly prepared source revision. Team policy applies
to the team's projects; personal projects remain independent.

These settings require host extension API 0.6.0 and its supporting published SDK.
Production presentation states are in `src/team-settings.canvas.tsx`; the Canvas uses
synthetic people and policy and makes no account changes.

See the [Cloud sync guide](../../documentation/guides/concepts/0007-cloud-sync.md) for sign-in, status and project controls.

Accounts without early access stay signed in and see **Coming soon**. **Offline**
means the connection is lost; **Local** means this project does not sync.

This extension uses the public account APIs and events. It does not implement
synchronization, encryption, device credentials, or VM provisioning. Sign-in progress
comes from the native account owner's `loginAttempt`; no extension setting duplicates
its request identity. Status and sign-in progress use events, without polling.

PS-1071 supplies the host/SDK prerequisite. Local development can link that SDK;
production adoption requires its actual compatible published host and SDK.

Design: `extensions/canvas/src/canvases/cloud.canvas.tsx`.

Source/file details: `src/sync-activity.canvas.tsx` → `DownloadDetails`.
It uses synthetic data and the production activity component. Details separate file
transfers from internal records and allow retrying one source after cancellation drains.
Source activity and scoped retry use the published SDK/UI pair
`0.47.1-nightly.20261113030235` and require a host supporting extension API 0.4.1.

Network loss shows **Connection lost** before sign-in or account-loading status, including signed-out clients. Reconnecting restores the current account and project status.
