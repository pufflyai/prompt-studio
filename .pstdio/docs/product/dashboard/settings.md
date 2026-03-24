---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Dashboard Settings and Onboarding

## Summary

The dashboard currently ships two settings-related surfaces: onboarding and global settings. Global settings now uses a sidebar + panel layout aligned with project settings, with an Agents panel focused on agent configuration.

## Problem

The old settings PRD described richer settings behavior than the current dashboard exposes and did not match the current global settings information architecture.

## Goals

- Document the current onboarding and global settings flows.
- Document the global settings sidebar/panel information architecture.
- Document manual agent add behavior and executable-path constraints.
- Document the project settings information architecture including the repositories panel.

## Non-Goals

- Editing, linking, or unlinking repositories from project settings.
- In-dashboard template editing.
- Multi-agent onboarding.

## Overview

Current settings routes:

- `/onboarding`
- `/settings`
- `/projects/:projectId/settings`

Onboarding blocks the main app until the user selects and configures an agent. The global settings page uses a sidebar with an `Agents` panel that lists known agents, indicates which agents are configured/default, and supports enable/disable/default actions. Manual add allows creating a config for a supported agent id (`claude-code` or `opencode`) with an executable path at creation time. Existing configured executable paths are shown as read-only text in this iteration.

## Requirements

### Functional Requirements

1. Accessing `/projects` before onboarding is complete must redirect to `/onboarding`.
2. Onboarding must run agent setup and persist the selected agent locally before continuing.
3. Global settings must use panel-based navigation with an `Agents` section.
4. Global settings must show available agents and current agent configs.
5. Global settings must support enabling, disabling, and setting the default agent.
6. Global settings must support manually adding a supported agent config with an executable path.
7. Existing configured executable paths must be displayed but not editable.
8. `/projects/:projectId/settings` must support a read-only repositories panel that shows linked repos with name and path, plus an empty state when none are linked.

### UX Requirements

- Onboarding should clearly show readiness for the supported agent.
- Global settings should distinguish installed, enabled, and default states.
- Global settings should expose manual-add affordance from the Agents panel.
- Existing configured executable paths should be visible as read-only values.

### Operational Requirements

- Onboarding completion is stored locally in agent storage.
- Global settings mutations call the agent-config APIs and surface errors with toasts.

## Behavior

1. If onboarding has not been completed, project routes redirect to `/onboarding`.
2. The onboarding screen currently offers a single choice: `opencode`.
3. Continuing onboarding runs the setup mutation, stores the selected agent, marks onboarding complete, and redirects to `/projects`.
4. The global settings page loads available agents and configured agents, then renders toggle and default actions for each one inside the `Agents` panel.
5. Selecting `Add agent manually` opens a flow that captures supported `agent_id` and executable path, then creates/updates the config via setup endpoint.
6. Existing configured rows show executable path text as read-only (`Not set` when absent).
7. The per-project settings route includes a read-only repositories panel showing linked repos (name and path) with an empty state when no repos are linked.

## Interface

### Routes

| Route | Purpose |
| ----- | ------- |
| `/onboarding` | Initial agent selection and setup. |
| `/settings` | Global settings shell with sidebar + `Agents` panel. |
| `/projects/:projectId/settings` | Project settings with tags, repositories, hooks, skills, templates, and danger zone panels. |

### Current Actions

| Action | Behavior |
| ------ | -------- |
| Continue onboarding | Configures the selected agent and unlocks the app. |
| Toggle agent | Enables or disables a configured agent. |
| Set default agent | Marks the selected agent config as default. |
| Add agent manually | Creates/updates a supported agent config with executable path at create time. |

## Rules & Constraints

- Onboarding currently supports `opencode` only.
- Manual add in global settings supports `claude-code` and `opencode` only.
- Project settings include tags, repositories (read-only), hooks, skills, templates, and danger zone.
- Repository management (add/remove) is handled in global settings, not project settings.
- Existing configured executable path is read-only in global settings for this phase.

## Errors

| Error | Cause |
| ----- | ----- |
| Onboarding setup error | Agent setup failed and onboarding could not complete. |
| Failed to enable / disable / set default agent | The corresponding settings mutation failed. |

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' packages/pstdio-dashboard/src/router.tsx`, `sed -n '1,220p' packages/pstdio-dashboard/src/features/settings/pages/settings-index.tsx`
- **Expected evidence**: Routing enforces onboarding, `/settings` manages agents, and `/projects/:projectId/settings` is still a placeholder.
- **Where to find artifacts**: `packages/pstdio-dashboard/src/features/onboarding/`, `packages/pstdio-dashboard/src/features/settings/`, `packages/pstdio-dashboard/src/features/project-settings/`
