---
status: "draft"
created: "2026-03-10T20:12:05Z"
---

# Product Requirements Document: Dashboard Documentation

## Summary

The dashboard documentation panel renders repo-local markdown docs discovered from the `.pstdio/docs/` folder tree.

## Problem

The old documentation PRD described draft behavior and did not clearly separate read-only browsing from authoring workflows.

## Goals

- Describe the current dashboard docs experience accurately.
- Clarify how docs are selected, loaded, and linked.
- Avoid implying that the dashboard is a docs authoring tool.

## Non-Goals

- In-browser document editing.
- Remote docs sync commands or a persisted docs snapshot flow.
- In-browser maintenance of the folder structure.

## Overview

The docs panel is available at:

- `/docs`
- `/projects/:projectId/docs`

It loads the discovered docs index for the selected project, derives the active document from the `doc` search parameter, and renders markdown content in a read-only editor.

## Requirements

### Functional Requirements

1. The sidebar must render from deterministic folder/file discovery under `.pstdio/docs/`.
2. The active doc must be reflected in the `doc` search parameter.
3. Internal markdown links must resolve to other docs in the same tree without a full page reload.
4. Missing docs and load failures must resolve to clear empty or error states.
5. The root `index.md` page must be available when present.

### UX Requirements

- When no `doc` query is present, the panel should redirect to the first valid discovered document.
- The reader should stay within the docs panel when clicking internal doc links.

### Operational Requirements

- The dashboard reads docs through the project docs API endpoints.
- The docs panel should work both at the global `/docs` route and inside a project shell.

## Behavior

1. Load the docs index for the current project.
2. Flatten the discovered folder/file index and resolve the active link.
3. If the current route has no valid `doc`, update the URL to the resolved active doc.
4. Fetch the selected document content and render it using the markdown viewer.
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
| `GET /v1/projects/{projectId}/docs` | Fetch the discovered docs index. |
| `GET /v1/projects/{projectId}/docs/content?link=<path>` | Fetch one markdown page. |

## Rules & Constraints

- The dashboard treats docs as read-only.
- If no markdown docs are found, the panel shows an authoring-focused empty state with repo-local doc setup guidance and clickable prompt suggestions that start a new project session from the selected documentation question.
- The docs panel depends on `.pstdio/docs` in the linked repo; it does not maintain a second copy.

## Errors

| Error | Cause |
| ----- | ----- |
| `Unable to load docs` | The docs index request failed. |
| `Unable to load document` | The selected markdown page could not be fetched. |

## Verification & Evidence

- **Commands to run**: `find .pstdio/docs -type f -name '*.md' | sort`
- **Expected evidence**: Discovered markdown files resolve under `.pstdio/docs/`, and dashboard docs routes match the links in this PRD.
- **Where to find artifacts**: `.pstdio/docs/`, `packages/pstdio-dashboard/src/features/documentation/`
