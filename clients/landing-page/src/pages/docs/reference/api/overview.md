---
layout: ../../../../layouts/docs-layout.astro
title: API overview
description: Base URLs, authentication, OpenAPI, and the shape of every /v1 resource group.
htmlTitle: HTTP API reference
htmlDescription: Base URLs, authentication, the OpenAPI document, and every /v1 resource group of the Prompt Studio local API.
section: References
category: API
categoryOrder: 3
order: 1
---

## Base URL

```text
http://localhost:19840
```

API resources are mounted under `/v1`. Health, docs, and shutdown routes live at the root.

Change the port with `pstdio --api-port <port>`, `pstdio serve --port <port>`, or `PSTDIO_API_PORT`. See [Ports and environment variables](/docs/operations/ports-and-env/).

## OpenAPI

| Route | Purpose |
| --- | --- |
| `GET /openapi.json` | Machine-readable OpenAPI 3.0 document. |
| `GET /docs` | Swagger UI for browsing and trying endpoints. |

## Authentication

If `PSTDIO_API_TOKEN` is set on the API process, every `/v1` request must include:

```text
Authorization: Bearer <token>
```

Health routes (`/healthz`, `/readyz`, `/ping`, `/openapi.json`, `/docs`, `/shutdown`) do not require a token. See [Authentication](/docs/operations/ports-and-env/#authentication) for the full flow.

## Resource groups

All paths below are under `/v1` unless the route is explicitly listed at root.

### Health and process

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/healthz` | Liveness probe. |
| GET | `/readyz` | Readiness probe. |
| GET | `/ping` | Health ping. |
| POST | `/shutdown` | Shut the API process down cleanly. |

### Projects and repos

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/projects` | List projects. |
| POST | `/projects` | Create a project. |
| GET | `/projects/{id}` | Get one project. |
| DELETE | `/projects/{id}` | Delete a project. |
| GET | `/projects/{id}/repos` | List repos registered under a project. |
| POST | `/projects/{id}/repos` | Register a repo. |
| DELETE | `/projects/{id}/repos/{repoId}` | Unregister a repo. |
| GET | `/repos/{repoId}/branches` | List branches of a repo. |

### Tickets and files

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/tickets` | List tickets (filters via query). |
| POST | `/tickets` | Create a ticket. |
| GET | `/tickets/{id}` | Get a ticket. |
| PATCH | `/tickets/{id}` | Update a ticket. |
| DELETE | `/tickets/{id}` | Delete a ticket. |
| POST | `/tickets/{id}/attempts` | Create an attempt. |
| POST | `/tickets/{id}/update-when-attempt-status` | Conditional ticket status update. |
| GET | `/projects/{projectId}/ticket-statuses` | List ticket statuses (alias for `/statuses`). |
| GET | `/tickets/{id}/files` | List files on a ticket. |
| POST | `/tickets/{id}/files` | Upload a file. |
| GET | `/tickets/{id}/files/{fileId}/content` | Download file bytes. |

### Workspaces

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/workspaces` | List workspaces. |
| POST | `/workspaces` | Create a workspace. |
| GET | `/workspaces/by-shorthand` | Get by `shorthand`. |
| DELETE | `/workspaces/{id}` | Delete a workspace. |
| POST | `/workspaces/{id}/archive` | Archive. |
| POST | `/workspaces/{id}/remove-worktree` | Remove the worktree. |
| PATCH | `/workspaces/{id}/attempt-status` | Update attempt status. |
| GET | `/workspaces/{id}/diff` | Full diff. |
| GET | `/workspaces/{id}/diff-summary` | Per-file diff stats. |
| GET | `/workspaces/{id}/startup-log` | Read startup log. |
| PUT | `/workspaces/{id}/startup-log` | Replace startup log. |

### Sessions

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/sessions` | List sessions. |
| POST | `/sessions` | Create a session. |
| GET | `/sessions/{id}` | Get a session. |
| GET | `/sessions/{id}/conversation` | Full conversation. |
| GET | `/sessions/{id}/stream` | Live SSE stream. |
| PATCH | `/sessions/{id}/status` | Update status. |
| POST | `/sessions/{id}/archive` | Archive. |
| POST | `/sessions/{id}/follow-up` | Send a follow-up. |
| POST | `/sessions/{id}/approve` | Approve a tool request. |
| POST | `/sessions/resolve-session-id` | Resolve by external agent id. |

### Agents

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/agents` | List configured agents. |
| GET | `/agents/info` | Rich agent availability. |
| GET | `/agents/availability` | Simple availability report. |
| GET | `/agents/{agentId}/models` | List models. |
| POST | `/agents` | Setup an agent. |
| POST | `/agents/setup-available` | Setup every available agent. |
| PATCH | `/agents/{agentId}` | Update config. |
| DELETE | `/agents/{agentId}` | Remove config. |

### Statuses

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/projects/{projectId}/statuses` | List ticket statuses. |
| POST | `/projects/{projectId}/statuses` | Create. |
| PATCH | `/projects/{projectId}/statuses/{id}` | Update (color). |
| PATCH | `/projects/{projectId}/statuses/{id}/set-default` | Set default. |
| DELETE | `/projects/{projectId}/statuses/{id}` | Delete. |
| GET | `/projects/{projectId}/attempt-statuses` | List attempt statuses. |
| POST | `/projects/{projectId}/attempt-statuses` | Create. |
| PATCH | `/projects/{projectId}/attempt-statuses/{id}` | Update. |
| DELETE | `/projects/{projectId}/attempt-statuses/{id}` | Delete. |

### Tags

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/projects/{projectId}/ticket-tags` | List tags. |
| POST | `/projects/{projectId}/ticket-tags` | Create a tag. |
| PUT | `/projects/{projectId}/ticket-tags/{id}` | Update. |
| DELETE | `/projects/{projectId}/ticket-tags/{id}` | Delete. |
| POST | `/projects/{projectId}/ticket-tags/{tagId}/options` | Create option. |
| PUT | `/projects/{projectId}/ticket-tags/{tagId}/options/{optionId}` | Update option. |
| DELETE | `/projects/{projectId}/ticket-tags/{tagId}/options/{optionId}` | Delete option. |

### Templates

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/projects/{projectId}/templates` | List. |
| POST | `/projects/{projectId}/templates` | Create. |
| GET | `/projects/{projectId}/templates/{name}` | Get by name. |
| PUT | `/projects/{projectId}/templates/{name}` | Update. |
| DELETE | `/projects/{projectId}/templates/{name}` | Delete. |

### Skills

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/projects/{projectId}/skills` | List. |
| GET | `/projects/{projectId}/skills/{name}` | Get one. |
| POST | `/projects/{projectId}/skills/{name}/update` | Reload from source. |

### Plugins and actions

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/projects/{projectId}/plugins` | List registered plugins. |
| POST | `/projects/{projectId}/plugins/register` | Re-register plugins. |
| GET | `/projects/{projectId}/actions` | List actions. |
| POST | `/projects/{projectId}/actions/{actionKey}/execute` | Execute an action. |

### Filesystem

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/filesystem/list` | List files in a given directory. |

### Sync

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/sync/stream` | Live change feed (SSE). Not under `/v1`. |

## Type definitions

All request and response shapes are defined with shared TypeScript and Zod contracts in the `pstdio-api-contracts` package. Use `@pstdio/sdk/api` for the input/response types and `@pstdio/sdk/resources` for resource shapes. See [Types reference](/docs/reference/types/) for the list.
