---
"pstdio": patch
---

Add a `lastResource` controller to the workbench core (with a matching `createLocalStorageLastResourcePersistence` adapter) so apps can persist and replay the last-opened resource. The dashboard workbench uses it to reopen on the view and mode the user left, and remembers panel open/closed state across reloads.
