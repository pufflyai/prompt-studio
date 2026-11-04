# Prompt Studio Cloud — Devices

Manage your devices from the Devices page or global settings. Cloud devices run
in your own DigitalOcean account, and your provider bills you directly. Stopping
keeps your data and device identity and continues provider billing for retained
resources. Provider power and account presence are shown separately.

This extension supplies the Devices surface for PS-828. Cloud status-bar, sync
settings and project-management surfaces remain separate work. It uses the public
account SDK and keeps provider credentials in the native owner. Tokens are
write-only and never synced or returned in extension responses.

The core/SDK prerequisite is PR #1750. The extension uses new unreleased account
methods; linked local qualification does not prove a supported published install.
Keep its draft PR marked `waiting-for-release` until compatible host/SDK artifacts
are published, then adopt their real versions and rerun the published consumer.

See [device login and cloud devices](../../documentation/guides/sdk/0004-device-login.md)
for the CLI and native configuration. No provider deployment or spending is
performed by previews or local qualification. Remote Workspaces remains until
replacement start-and-drive-session acceptance is proved.

Canvas source: `src/devices.canvas.tsx`, frame `StartStopAndRecover`. Its synthetic
handler demonstrates provider errors and recovery without creating real records.
