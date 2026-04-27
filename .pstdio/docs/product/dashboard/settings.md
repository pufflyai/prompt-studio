---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Dashboard Settings and Project Harness Selection

## Summary

The dashboard settings target is a global settings surface plus project creation with harness selection. Global settings uses a sidebar + panel layout aligned with project settings, with a Harnesses panel focused on provider configuration.

## Problem

Earlier settings requirements described richer behavior than the current dashboard exposes and did not match the current global settings information architecture.

## Goals

- Document the current project creation and global settings flows.
- Document the global settings sidebar/panel information architecture.
- Document manual harness provider add behavior and executable-path constraints.
- Document the project settings information architecture including the repositories panel.

## Non-Goals

- Editing, linking, or unlinking repositories from project settings.
- In-dashboard template editing.
- Harness setup during first-run onboarding.

## Overview

Current settings routes:

- `/settings`
- `/projects/:projectId/settings`

Project creation includes a second step for selecting harness providers, with all available providers selected by default. If no harness providers are available on the machine, project creation is disabled and the projects page shows a warning banner with recovery guidance (Settings -> Harnesses and manual add/setup paths). Existing projects remain visible and accessible. The global settings page uses a sidebar with a `Harnesses` panel that lists known providers, indicates which providers are configured/default, and supports enable/disable/default actions. Manual add allows creating configuration for a supported provider id (`claude-code` or `opencode`) with an executable path at creation time. Existing configured executable paths are shown as read-only text in this iteration.

## Requirements

### Functional Requirements

1. `/projects` must always remain accessible regardless of onboarding state.
2. Project creation must include a harness-selection step after project details/repositories.
3. All available harness providers must be pre-selected in the harness-selection step by default.
4. If no harness providers are available, project creation controls must be disabled and a warning banner must be shown on `/projects`.
5. The warning banner must clearly explain how to add providers using Settings -> Harnesses, including setup/manual add paths.
6. Existing projects and project navigation must remain available when no harness providers are available.
7. Global settings must use panel-based navigation with a `Harnesses` section.
8. Global settings must show available harness providers and current provider configs.
9. Global settings must support enabling, disabling, and setting the default harness provider.
10. Global settings must support manually adding a supported provider config with an executable path.
11. Existing configured executable paths must be displayed but not editable.
12. `/projects/:projectId/settings` must support a read-only repositories panel that shows linked repos with name and path, plus an empty state when none are linked.

### UX Requirements

- Project creation should clearly separate project details (step 1) from harness selection (step 2).
- Global settings should distinguish installed, enabled, and default states.
- Global settings should expose manual-add affordance from the Harnesses panel.
- Existing configured executable paths should be visible as read-only values.

### Operational Requirements

- Harness availability on the projects list is sourced from harness info endpoints.
- Global settings mutations call harness configuration APIs and surface errors with toasts.

## Behavior

1. Project routes no longer depend on onboarding completion state.
2. Project creation runs as a two-step flow: project details/repositories, then harness selection.
3. Available harness providers are pre-selected on step 2; users can deselect before creating.
4. If no available providers are found, project creation is disabled and the warning banner explains how to recover.
5. Existing projects remain visible and can still be opened when project creation is blocked.
6. The global settings page loads available harness providers and configured providers, then renders toggle and default actions for each one inside the `Harnesses` panel.
7. Selecting `Add harness manually` opens a flow that captures supported provider id and executable path, then creates/updates the config via setup endpoint.
8. Existing configured rows show executable path text as read-only (`Not set` when absent).
9. The per-project settings route includes a read-only repositories panel showing linked repos (name and path) with an empty state when none are linked.
10. The skill detail view shows the skill name, current version badge, description, and full content.
11. When a newer bundled version is available, an "Update to vX" button appears and propagates the updated skill to all configured harness provider directories in linked repos.
12. Each skill shows per-provider installation badges (green, e.g. `claude-code`, `opencode`) indicating which providers have the skill installed locally on disk. When no providers have the skill installed, a "Not installed locally" label is shown instead.

## Interface

### Routes

| Route | Purpose |
| ----- | ------- |
| `/settings` | Global settings shell with sidebar + `Harnesses` panel. |
| `/projects/:projectId/settings` | Project settings with tags, repositories, extensions, skills, templates, and danger zone panels. |

### Current Actions

| Action | Behavior |
| ------ | -------- |
| Create project (step 2) | Selects which available harness providers to use, all selected by default. |
| Toggle harness | Enables or disables a configured provider. |
| Set default harness | Marks the selected provider config as default. |
| Add harness manually | Creates/updates a supported provider config with executable path at create time. |

## Rules & Constraints

- Manual add in global settings supports `claude-code` and `opencode` only.
- Project creation is blocked when no harness provider is available.
- Project settings include tags, repositories (read-only), extensions, skills, templates, and danger zone.
- Repository management (add/remove) is handled in global settings, not project settings.
- Existing configured executable path is read-only in global settings for this phase.
- Skill installation badges reflect real-time filesystem checks against provider directories in linked repos.

## Errors

| Error | Cause |
| ----- | ----- |
| No harness providers available | Project creation is blocked until a provider is installed/configured. |
| Failed to enable / disable / set default harness | The corresponding settings mutation failed. |

## Verification & Evidence

- **Commands to run**: `bun test packages/pstdio-dashboard/src/features/project-list/pages/project-list.test.ts`, `bun test packages/e2e/src/ui/projects.spec.ts`
- **Expected evidence**: Project creation has a second harness step, no-provider state shows blocking banner, and existing project navigation remains available.
- **Where to find artifacts**: `packages/pstdio-dashboard/src/features/project-list/`, `packages/pstdio-dashboard/src/features/settings/`, `packages/pstdio-dashboard/src/features/project-settings/`
