---
"pstdio": patch
---

Render project extension routes through `pstdio-shell`. `ProjectExtensionRoute` now composes a `ShellWorkbench` instead of a bespoke panel layout, and the shell bridge webview renderer accepts host-injected capability and props factories so extension webviews keep reaching the dashboard's command API, navigation, and toasts. Also fixes duplicated toasts on shell-backed routes: `ShellNotificationHost` now bridges into the shared toaster singleton without rendering a second viewport, and untrusted webview iframes never receive `allow-same-origin`.
