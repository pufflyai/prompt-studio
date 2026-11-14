---
"pstdio": patch
"@pstdio/ui": patch
---

Reduce repeated row-layout styling while streamed replies update. Shared theme rules emit static row geometry and token spacing once rather than serializing them on every streaming measurement.
