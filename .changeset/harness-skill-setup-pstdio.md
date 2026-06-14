---
"pstdio": patch
---

Remove the KNOWN_AGENTS registry: skill setup is driven by harness-declared skill directories and follows the harness lifecycle — skills install for project-enabled harnesses and are removed from a harness's directories when its extension is disabled or uninstalled. /agents/info now reports each harness's skills layout and CLI agent commands accept any installed harness id.
