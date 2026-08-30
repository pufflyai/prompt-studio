---
"pstdio": minor
"@pstdio/sdk": minor
"@pstdio/workbench": minor
"pstdio-planner": minor
"extension-lab": minor
"pstdio-skills": patch
---

Add the `page` contribution: one declaration composes a tool screen from slots and bindings, with derived tabs, per-slot open policy, namespaced page URLs (`/projects/{project}/{extension-id}/{path}`), host page refs (`workbenchPages.workspaces|sessions|start`), in-page resource emissions, and a `(page, resource?)` navigable location shared by the URL, history, and boot restore. Removes resource-views, resource-kind slots and `surface`, view and resource navigation targets, `ViewContribution.path`, and caller open strategies; `pst extensions check` rejects the removed API naming the replacement. External consumers of the removed navigation targets (for example granite) must migrate to page targets.
