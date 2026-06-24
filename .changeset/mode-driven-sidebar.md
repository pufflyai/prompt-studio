---
"pstdio": minor
---

Refactor the dashboard sidebar into one mode-reactive widget: a single sidebar composes its header/body/footer from mode-gated contributions (project/session/workspace plus extension-declared modes such as ticket). The session list becomes one collapsible "Sessions" group shown/hidden as a unit; search · new-session are header-region contributions (mirroring the footer) rendered as stacked rows under the project selector, so search stays available in every mode including extension modes like ticket. The workbench left side-panel header now sizes to its content to host the stacked cluster.
