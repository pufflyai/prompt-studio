---
"pstdio": patch
---

Fix extension reads that could stop responding under heavy load, by yielding between read bursts with a timer instead of `setImmediate`.
