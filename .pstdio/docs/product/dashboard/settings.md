---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Dashboard Settings and Onboarding

## Summary

The dashboard currently ships two settings-related surfaces: onboarding and global agent settings. A project settings route exists, but it is still a placeholder.

## Problem

The old settings PRD described richer settings behavior than the current dashboard exposes.

## Goals

- Document the current onboarding and global settings flows.
- Call out the project settings placeholder plainly.
- Remove stale expectations about per-project configuration UIs.

## Non-Goals

- A complete project settings experience.
- In-dashboard template editing.
- Multi-agent onboarding.

## Overview

Current settings routes:

- `/onboarding`
- `/settings`
- `/projects/:projectId/settings`

Onboarding blocks the main app until the user selects and configures an agent. The global settings page lists available agents and lets the user enable, disable, and set a default. The per-project settings route is a placeholder label only.

## Requirements

### Functional Requirements

1. Accessing `/projects` before onboarding is complete must redirect to `/onboarding`.
2. Onboarding must run agent setup and persist the selected agent locally before continuing.
3. Global settings must show available agents and current agent configs.
4. Global settings must support enabling, disabling, and setting the default agent.
5. `/projects/:projectId/settings` must remain explicitly documented as placeholder behavior until a real UI ships.

### UX Requirements

- Onboarding should clearly show readiness for the supported agent.
- Global settings should distinguish installed, enabled, and default states.

### Operational Requirements

- Onboarding completion is stored locally in agent storage.
- Global settings mutations call the agent-config APIs and surface errors with toasts.

## Behavior

1. If onboarding has not been completed, project routes redirect to `/onboarding`.
2. The onboarding screen currently offers a single choice: `opencode`.
3. Continuing onboarding runs the setup mutation, stores the selected agent, marks onboarding complete, and redirects to `/projects`.
4. The global settings page loads available agents and configured agents, then renders toggle and default actions for each one.
5. The per-project settings route currently renders placeholder content only.

## Interface

### Routes

| Route | Purpose |
| ----- | ------- |
| `/onboarding` | Initial agent selection and setup. |
| `/settings` | Global agent settings. |
| `/projects/:projectId/settings` | Placeholder project settings route. |

### Current Actions

| Action | Behavior |
| ------ | -------- |
| Continue onboarding | Configures the selected agent and unlocks the app. |
| Toggle agent | Enables or disables a configured agent. |
| Set default agent | Marks the selected agent config as default. |

## Rules & Constraints

- Onboarding currently supports `opencode` only.
- Project settings are not implemented yet.
- Settings behavior is global; there is no shipped per-project settings editor.

## Errors

| Error | Cause |
| ----- | ----- |
| Onboarding setup error | Agent setup failed and onboarding could not complete. |
| Failed to enable / disable / set default agent | The corresponding settings mutation failed. |

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' packages/pstdio-dashboard/src/router.tsx`, `sed -n '1,220p' packages/pstdio-dashboard/src/features/settings/pages/settings-index.tsx`
- **Expected evidence**: Routing enforces onboarding, `/settings` manages agents, and `/projects/:projectId/settings` is still a placeholder.
- **Where to find artifacts**: `packages/pstdio-dashboard/src/features/onboarding/`, `packages/pstdio-dashboard/src/features/settings/`, `packages/pstdio-dashboard/src/features/project-settings/`
