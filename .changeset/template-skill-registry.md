---
"pstdio": minor
---

Make `GET /v1/projects/:projectId/templates` and `…/skills` return the merged registry: enabled extension-provided defaults plus project-owned rows, distinguished by `source_kind` and `read_only` on every row. `GET …/templates/:name` and `…/skills/:name` resolve project-owned items first and fall back to extension defaults addressed as `<namespace>.<key>`. Mutating an extension default returns 403 and points users at the copy/preference endpoints. Added extension-scoped action endpoints under `…/templates/extension/:extensionId/:key/{preference,copy,content}` (and the skill mirror). Extension runtime emits new `missing_template_asset`, `missing_skill_asset`, `duplicate_template_key`, and `duplicate_skill_key` diagnostics surfaced through `pstdio extensions check`. `extension_template_preferences`, `extension_skill_preferences`, and `skills` rows now flow through CLI/dashboard sync.
