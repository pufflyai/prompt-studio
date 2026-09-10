# Beta features

Open Settings → Workbench → Beta features to enable Notifications. Notifications start disabled on new and existing installations. The setting applies to every project and dashboard connected to this installation.

Enabling Notifications shows its navigation item, command, shortcut (Alt+Shift+N), and center. Disabling it closes the center and removes those entry points. Notification producers continue working and saved notifications stay intact. Ordinary feedback toasts and permission prompts are unaffected.

Agents use GET and PATCH `/v1/settings` with the boolean `notifications_enabled`. This setting persists independently of `max_concurrent_sessions`. Connected dashboards receive changes through the settings sync table, including on reconnect.
