# PRD: Beta features

Open Settings → Experimental → Beta features to enable Notifications or Machine tokens. The page uses a flask icon. Both start disabled on new and existing installations. Each setting applies to every project and dashboard connected to this installation.

Enabling Notifications shows its navigation item, command, shortcut (Alt+Shift+N), and center. Disabling it closes the center and removes those entry points. Notification producers continue working and saved notifications stay intact. Ordinary feedback toasts and permission prompts are unaffected.

Enabling Machine tokens shows the Machine tokens panel in project settings. Disabling it removes the panel. Issued tokens keep working, and `pst auth tokens` works while the panel is hidden.

Agents use GET and PATCH `/v1/settings` with the booleans `notifications_enabled` and `machine_tokens_enabled`. Each setting persists independently of the others and of `max_concurrent_sessions`. Connected dashboards receive changes through the settings sync table, including on reconnect.

## Delivery record

Checked on 2026-10-18 against main commit `45580feb`. The newest stable release is `pstdio@0.43.1`.

| Field | Record |
| --- | --- |
| Status | Released. |
| Implementation | Notifications opt-in and the Beta features page came in #690. Machine tokens gating came in #1022. Settings live in `packages/pstdio-api/src/features/settings/` and the panel registration in `packages/pstdio-dashboard/src/modules/settings/settings-contributions.tsx`. |
| Availability | The Notifications switch shipped in `pstdio@0.33.1`. The Machine tokens switch shipped in `pstdio@0.43.0`. |
| Remaining work | None known. |
| Evidence | Unit tests, passed locally on 2026-10-18: `settings.test.ts` (notification opt-in sync and a separate machine-tokens switch) and `settings-sync.test.ts` (settings restored in a new sync snapshot). The dashboard entry points were checked by source inspection only; no browser journey is recorded here. |
