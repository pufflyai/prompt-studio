---
---

---

## v0.1.0

**Date:** Mar 13, 2026
**Tags:** sessions, agents, workspaces, dashboard
**Title:** Sessions, Agents & Workspaces

This release turns pstdio from a project scaffolding tool into a full agent-assisted workflow system. You can now run AI agent sessions directly from the CLI, stream their output in real-time, and manage isolated workspaces for each ticket attempt.

### Changes

- **Sessions** — Create, stream, and manage agent sessions from the CLI and dashboard. Watch agent output in real-time, send follow-up prompts, and approve or deny tool permission requests. Completed sessions persist their full message history so nothing is lost on restart.
- **Agents** — Configure and manage multiple AI agents (Claude Code, OpenCode, etc.). Set a default agent, install bundled skills, and control which agents are available per project.
- **Workspaces** — Isolate ticket work in git worktrees. Each attempt gets its own branch, and you can squash-merge changes back when ready.
- **Tags & Statuses** — Organize tickets with colored tags and custom workflow statuses. Comes with sensible defaults (bug, feature, documentation tags; backlog → done statuses) that you can customize.
- **Kanban board** — Visual ticket board grouped by status with drag-and-drop to move tickets through your workflow.
- **Real-time dashboard sync** — All changes stream live to the dashboard via SSE. No more refreshing to see updates from the CLI or running agents.
- **Session panel** — Dedicated dashboard panel for browsing sessions, viewing chat history, and interacting with running agents.
- **Dashboard settings & onboarding** — Guided setup flow for configuring your first agent, plus a settings page to manage agents.
- **Session dropdown** — Quick access to your 6 most recent sessions from anywhere in the dashboard.

---

## v0.0.1

**Date:** Mar 7, 2026
**Tags:** initial
**Title:** Initial Release

First release of prompt-studio.

### Changes

- **CLI foundation** — Basic CLI commands for projects, templates, and tickets.
- **Dashboard** — Initial dashboard UI with project sidebar and documentation viewer.
- **Documentation system** — Markdown-based docs with navigation, outline, and pagination components.
