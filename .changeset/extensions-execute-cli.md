---
"pstdio": minor
---

Execute v2 extension commands end-to-end through the CLI. Adds an API command runner with middleware chain, lifecycle events, hooks, nested-command depth protection, and project-scoped storage; a `POST /v1/extensions/commands/:commandId/execute` endpoint; SDK client method `extensions.execute`; and dynamic CLI dispatch so installed extensions register `pstdio <namespace> <command>` paths and route them through the API.
