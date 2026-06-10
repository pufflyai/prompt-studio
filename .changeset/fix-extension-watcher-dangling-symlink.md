---
"pstdio": patch
---

Stop the extension source watcher from crashing the API when an installed extension's tree contains a dangling symlink (e.g. an unresolved devDep inside its node_modules in an isolated container). Watcher errors are now routed to the logger instead of bubbling up as an unhandled 'error' event.
