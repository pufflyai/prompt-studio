---
"@pstdio/desktop": patch
---

Open the desktop workbench when the splash screen is visible even on systems where Chromium omits paint timing.
Release canceled startup attempts while their document is loading so another runtime can open.
Keep native recovery controls available when the desktop bridge fails to initialize.
