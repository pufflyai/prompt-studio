---
"@pstdio/workbench": patch
"pstdio": patch
---

Views keep loading until slow reads finish instead of failing with "The view took too long to load" after 30 seconds.
