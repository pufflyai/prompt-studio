---
status: "draft"
created: "2026-03-18T12:00:00Z"
---

# Product Requirements Document: Dashboard Page Titles

## Summary

The dashboard dynamically sets the browser tab title based on the current route, reflecting the project name, active section, and contextual details like session names or document titles.

## Problem

Without meaningful page titles, browser tabs all display the same generic label, making it difficult to distinguish between multiple open dashboard tabs or find a specific project/session when many tabs are open.

## Goals

- Provide contextual, human-readable browser tab titles for every dashboard route.
- Include the project name as a prefix for project-scoped routes.
- Reflect the active sub-section (tickets, sessions, settings, docs) in the title.
- Show granular context where available (session title, document title, ticket shorthand, workspace shorthand).

## Non-Goals

- Breadcrumb UI or in-page title rendering — this feature only controls the browser tab title.
- SEO optimization — the dashboard is a client-side app, not publicly indexed.
- User-configurable title templates.

## Routes and Titles

| Route                                             | Example Title                   |
| ------------------------------------------------- | ------------------------------- |
| `/projects`                                       | `Projects`                      |
| `/projects/:id/tickets`                           | `Project Name > Tickets`        |
| `/projects/:id/tickets/:shorthand`                | `Project Name > PS-41`          |
| `/projects/:id/tickets/:shorthand/workspaces/:ws` | `PS-41 > A1`                    |
| `/projects/:id/sessions`                          | `Project Name > Sessions`       |
| `/projects/:id/sessions/:sessionId`               | `Session Title`                 |
| `/projects/:id/settings`                          | `Project Name > Settings`       |
| `/projects/:id/settings?panel=tags`               | `Project Name > Tags`           |
| `/projects/:id/settings?panel=startup-script`     | `Project Name > Startup Script` |
| `/projects/:id/settings?panel=danger-zone`        | `Project Name > Danger Zone`    |
| `/projects/:id/settings?panel=template:Bugfix`    | `Project Name > Bugfix`         |
| `/projects/:id/docs`                              | `Project Name > Docs`           |
| `/projects/:id/docs?doc=:path`                    | `Doc Title`                     |
| `/settings`                                       | `Settings`                      |
| `/onboarding`                                     | `Onboarding`                    |

## Requirements

1. The title must update on every route change, including search param changes (`?panel=`, `?doc=`).
2. Most project-scoped routes include the project name as a prefix separated by `>`. Workspace and doc-detail routes skip the project prefix for brevity.
3. When a session is selected, the title must show the session's display title, not the session ID.
4. When a document is selected, the title must show the document's sidebar label, not the full path.
5. Settings sub-panels must map to human-readable names (e.g., `startup-script` → `Startup Script`). Template settings show the template name directly.
6. Ticket routes must show the ticket shorthand (e.g., `PS-41`). Workspace routes show `ticket > attempt` without the project prefix, stripping the ticket prefix from the workspace shorthand (e.g., `PS-41_A1` becomes `PS-41 > A1`).
7. Titles should be concise — only one level after the project name, no redundant labels or deep nesting.
8. Titles must not render loading artifacts like "undefined" — fall back gracefully when data is not yet available.

## Fallbacks

| Scenario              | Fallback                                 |
| --------------------- | ---------------------------------------- |
| Missing project name  | Show section only without project prefix |
| Missing session title | Show "Sessions"                          |
| Missing doc title     | Show "Docs"                              |
| Unknown route         | Show app title                           |
