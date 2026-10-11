# PRD: Beta features

Open Settings → Experimental → Beta features to enable Notifications or Machine tokens. The page uses a flask icon. Both start disabled on new and existing installations. Each setting applies to every project and dashboard connected to this installation.

Enabling Notifications shows its navigation item, command, shortcut (Alt+Shift+N), and center. Disabling it closes the center and removes those entry points. Notification producers continue working and saved notifications stay intact. Ordinary feedback toasts and permission prompts are unaffected.

Enabling Machine tokens shows the Machine tokens panel in project settings. Disabling it removes the panel. Issued tokens keep working, and `pst auth tokens` works while the panel is hidden.

Agents use GET and PATCH `/v1/settings` with the booleans `notifications_enabled` and `machine_tokens_enabled`. Each setting persists independently of the others and of `max_concurrent_sessions`. Connected dashboards receive changes through the settings sync table, including on reconnect.
