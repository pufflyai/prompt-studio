---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Dashboard Documentation

## Summary

The dashboard documentation panel renders repo-local markdown docs using `.pstdio/docs/navigation.json` as the sidebar source of truth.

## Problem

The old documentation PRD described draft behavior and did not clearly separate read-only browsing from authoring workflows.

## Goals

- Describe the current dashboard docs experience accurately.
- Clarify how docs are selected, loaded, and linked.
- Avoid implying that the dashboard is a docs authoring tool.

## Non-Goals

- In-browser document editing.
- Remote docs sync commands or a persisted docs snapshot flow.
- A second navigation model separate from `.pstdio/docs/navigation.json`.

## Overview

The docs panel is available at:

- `/docs`
- `/projects/:projectId/docs`

It loads the docs index for the selected project, derives the active document from the `doc` search parameter, and renders markdown content in a read-only editor.

Sidebar items may also declare an optional `template` field in `.pstdio/docs/navigation.json`.
Supported values:

- `changelog`: render markdown content with the changelog timeline UI.
- any other value (or missing): render via the standard markdown viewer.

## Requirements

### Functional Requirements

1. The sidebar must render from `navigation.json`.
2. The active doc must be reflected in the `doc` search parameter.
3. Internal markdown links must resolve to other docs in the same tree without a full page reload.
4. Missing docs and load failures must resolve to clear empty or error states.
5. Template-aware docs pages must switch renderers based on the active sidebar item's `template`.

### UX Requirements

- When no `doc` query is present, the panel should redirect to the first valid sidebar entry.
- The reader should stay within the docs panel when clicking internal doc links.

### Operational Requirements

- The dashboard reads docs through the project docs API endpoints.
- The docs panel should work both at the global `/docs` route and inside a project shell.

## Behavior

1. Load the docs index for the current project.
2. Flatten the sidebar items and resolve the active link.
3. If the current route has no valid `doc`, update the URL to the resolved active doc.
4. Fetch the selected document content and render it using the template-aware renderer.
5. Intercept internal markdown links and navigate to the matching docs link inside the panel.

## Interface

### Routes

| Route | Purpose |
| ----- | ------- |
| `/docs?doc=/path` | Render docs outside a project shell. |
| `/projects/:projectId/docs?doc=/path` | Render docs for a specific project. |

### API

| Endpoint | Purpose |
| -------- | ------- |
| `GET /v1/projects/{projectId}/docs` | Fetch the sidebar index. |
| `GET /v1/projects/{projectId}/docs/content?link=<path>` | Fetch one markdown page. |

## Rules & Constraints

- The dashboard treats docs as read-only.
- If `navigation.json` is empty, the panel shows an authoring-focused empty state with repo-local doc setup guidance and clickable prompt suggestions that start a new project session from the selected documentation question.
- The docs panel depends on `.pstdio/docs` in the linked repo; it does not maintain a second copy.

## Errors

| Error | Cause |
| ----- | ----- |
| `Unable to load docs` | The docs index request failed. |
| `Unable to load document` | The selected markdown page could not be fetched. |

## Verification & Evidence

- **Commands to run**: `sed -n '1,220p' .pstdio/docs/navigation.json`
- **Expected evidence**: Sidebar entries resolve to files under `.pstdio/docs/`, and dashboard docs routes match the links in this PRD.
- **Where to find artifacts**: `.pstdio/docs/navigation.json`, `packages/pstdio-dashboard/src/features/documentation/`
