---
"@pstdio/ui": minor
"@pstdio/workbench": minor
---

Hosts can save the chosen theme outside browser storage: `ThemePreferenceProvider` accepts `storage`, and `Workbench` and `WorkbenchThemeProvider` accept `themeStorage`. `useThemePreference()` reports `pendingThemePreference` while a chosen extension theme loads.
