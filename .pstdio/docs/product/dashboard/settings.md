---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Dashboard Settings and Project Agent Selection

## Summary

The dashboard currently ships a global settings surface plus project creation with agent selection. Global settings uses a sidebar + panel layout aligned with project settings, with an Agents panel focused on agent configuration.

## Problem

The old settings PRD described richer settings behavior than the current dashboard exposes and did not match the current global settings information architecture.

## Goals

- Document the current project creation and global settings flows.
- Document the global settings sidebar/panel information architecture.
- Document manual agent add behavior and executable-path constraints.
- Document the project settings information architecture including the repositories panel.

## Non-Goals

- Editing, linking, or unlinking repositories from project settings.
- In-dashboard template editing.
- Agent setup during first-run onboarding.

## Overview

Current settings routes:

- `/settings`
- `/projects/:projectId/settings`

Project creation includes a second step for selecting agents, with all installed agents selected by default. If no agents are installed on the machine, project creation is disabled and the projects page shows a warning banner with recovery guidance (Settings -> Agents and manual add/setup paths). Existing projects remain visible and accessible. The global settings page uses a sidebar with an `Agents` panel that lists known agents, indicates which agents are configured/default, and supports enable/disable/default actions. Manual add allows creating a config for a supported agent id (`claude-code` or `opencode`) with an executable path at creation time. Existing configured executable paths are shown as read-only text in this iteration.

## Requirements

### Functional Requirements

1. `/projects` must always remain accessible regardless of onboarding state.
2. Project creation must include an agent-selection step after project details/repositories.
3. All installed agents must be pre-selected in the agent-selection step by default.
4. If no agents are installed, project creation controls must be disabled and a warning banner must be shown on `/projects`.
5. The warning banner must clearly explain how to add agents using Settings -> Agents, including setup/manual add paths.
6. Existing projects and project navigation must remain available when no agents are installed.
7. Global settings must use panel-based navigation with an `Agents` section.
8. Global settings must show available agents and current agent configs.
9. Global settings must support enabling, disabling, and setting the default agent.
10. Global settings must support manually adding a supported agent config with an executable path.
11. Existing configured executable paths must be displayed but not editable.
12. `/projects/:projectId/settings` must support a read-only repositories panel that shows linked repos with name and path, plus an empty state when none are linked.

### UX Requirements

- Project creation should clearly separate project details (step 1) from agent selection (step 2).
- Global settings should distinguish installed, enabled, and default states.
- Global settings should expose manual-add affordance from the Agents panel.
- Existing configured executable paths should be visible as read-only values.

### Operational Requirements

- Agent availability on the projects list is sourced from `/v1/agents/info`.
- Global settings mutations call the agent-config APIs and surface errors with toasts.

## Behavior

1. Project routes no longer depend on onboarding completion state.
2. Project creation runs as a two-step flow: project details/repositories, then agent selection.
3. Installed agents are pre-selected on step 2; users can deselect before creating.
4. If no installed agents are found, project creation is disabled and the warning banner explains how to recover.
5. Existing projects remain visible and can still be opened when project creation is blocked.
6. The global settings page loads available agents and configured agents, then renders toggle and default actions for each one inside the `Agents` panel.
7. Selecting `Add agent manually` opens a flow that captures supported `agent_id` and executable path, then creates/updates the config via setup endpoint.
8. Existing configured rows show executable path text as read-only (`Not set` when absent).
9. The per-project settings route includes a read-only repositories panel showing linked repos (name and path) with an empty state when none are linked.
10. The skill detail view shows the skill name, current version badge, description, and full content.
11. When a newer bundled version is available, an "Update to vX" button appears and propagates the updated skill to all agent directories in linked repos.
12. Each skill shows per-agent installation badges (green, e.g. `claude-code`, `opencode`) indicating which agents have the skill installed locally on disk. When no agents have the skill installed, a "Not installed locally" label is shown instead.

## Interface

### Routes

| Route | Purpose |
| ----- | ------- |
| `/settings` | Global settings shell with sidebar + `Agents` panel. |
| `/projects/:projectId/settings` | Project settings with tags, repositories, hooks, skills, templates, and danger zone panels. |

### Current Actions

| Action | Behavior |
| ------ | -------- |
| Create project (step 2) | Selects which installed agents to use, all selected by default. |
| Toggle agent | Enables or disables a configured agent. |
| Set default agent | Marks the selected agent config as default. |
| Add agent manually | Creates/updates a supported agent config with executable path at create time. |

## Rules & Constraints

- Manual add in global settings supports `claude-code` and `opencode` only.
- Project creation is blocked when `/v1/agents/info` reports zero installed agents.
- Project settings include tags, repositories (read-only), hooks, skills, templates, and danger zone.
- Repository management (add/remove) is handled in global settings, not project settings.
- Existing configured executable path is read-only in global settings for this phase.
- Skill installation badges reflect real-time filesystem checks against agent directories in linked repos.

## Errors

| Error | Cause |
| ----- | ----- |
| No agents available | Project creation is blocked until an agent is installed/configured. |
| Failed to enable / disable / set default agent | The corresponding settings mutation failed. |

## Verification & Evidence

- **Commands to run**: `bun test packages/pstdio-dashboard/src/features/project-list/pages/project-list.test.ts`, `bun test packages/e2e/src/ui/projects.spec.ts`
- **Expected evidence**: Project creation has a second agent step, no-agent state shows blocking banner, and existing project navigation remains available.
- **Where to find artifacts**: `packages/pstdio-dashboard/src/features/project-list/`, `packages/pstdio-dashboard/src/features/settings/`, `packages/pstdio-dashboard/src/features/project-settings/`
