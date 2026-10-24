---
"pstdio-skills": patch
---

Tell extension authors to keep storage records small and store large content as files, because 0.46 refuses records over 256 KiB and commits over 4 MiB; the Scribble example now saves note bodies as files.
