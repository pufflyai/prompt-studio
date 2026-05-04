---
"pstdio": minor
---

Add a project-scoped default harness and default model: project settings now expose an "Agents" panel, and `createSession` (REST + SDK + plugin helper) falls back to those defaults when callers omit `agent`/`model`.
