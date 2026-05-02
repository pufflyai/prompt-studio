---
"pstdio": minor
---

Add extension platform DB tables: `installed_extension_sources`, `project_extension_instances`, `extension_kv`, `extension_collection_items`, `extension_template_preferences`, `extension_skill_preferences`. Broaden `activity_events.resource_type` to a free-form string so extension-typed resources can be recorded. Add `type` and `anchors_json` columns to `workspaces`, and `anchors_json` to `sessions`, both backed by `ResourceRef[]`.
