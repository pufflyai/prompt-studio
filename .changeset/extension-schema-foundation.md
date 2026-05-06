---
"pstdio": patch
"@pstdio/sdk": patch
---

Add the durable extension schema foundation in `pstdio-db`: installed extension sources, scope-aware extension instances, extension KV/collection state, project-owned extension preferences (template/skill), `project_template_defaults`, normalized project skill files (`skill_files` + `entrypoint_file_id`), and reload events. Activity events now accept any `resource_type` string and carry `source_extension_id`; sessions and workspaces expose `anchors_json: ResourceRef[]`. The legacy `templates.is_default` column moves to `project_template_defaults` while the existing API surface continues to compute `is_default` for compatibility.
