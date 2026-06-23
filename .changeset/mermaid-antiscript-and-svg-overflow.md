---
"@pstdio/ui": patch
"pstdio": patch
---

Harden the Mermaid renderer: switch to `antiscript` security level, repair the SVG XML so HTML labels render in `<img>`, and keep the fullscreen diagram inside the surface.
