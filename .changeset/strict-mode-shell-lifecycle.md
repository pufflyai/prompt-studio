---
"pstdio": patch
---

Fix dashboard shell pages crashing under React StrictMode by tying shell creation and disposal to a single effect lifecycle.
