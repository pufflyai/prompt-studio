# Prompt Studio Cloud

The status widget shows connection loss, download progress, and local project preparation. Opening a Cloud project keeps navigation available while its folder is prepared in the background. Setup failures stay visible in Cloud details and the status bar.

The optional Cloud extension shows account and project sync status in the status bar.
Install **Prompt Studio Cloud** from **Extensions**.
Open it for details, then choose **Cloud settings** to sign in, manage your devices,
or make this project local. Making a project local stops syncing on every device;
each keeps its copy. Syncing again merges those copies.

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

Network loss shows **Connection lost** before sign-in or account-loading status, including signed-out clients. Reconnecting restores the current account and project status.
