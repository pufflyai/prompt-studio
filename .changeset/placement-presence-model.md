---
"@pstdio/workbench": minor
"@pstdio/sdk": minor
"pstdio": minor
"extension-lab": patch
"pstdio-planner": patch
"pstdio-skills": patch
---

Replace the placement lifecycle flags with one explicit model: static items declare `presence`, resource bindings require `cardinality` and own their Add panel `add` action, page slots use `openOn: "page-resource"`, keybindings execute navigation `action` values, and region size policy moves to mode and host `regionSettings`.
