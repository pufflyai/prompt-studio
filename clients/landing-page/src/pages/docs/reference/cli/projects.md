---
layout: ../../../../layouts/docs-layout.astro
title: pstdio projects
description: Reference for the pstdio projects command group.
htmlTitle: pstdio projects CLI
htmlDescription: Create, link, list, and delete Prompt Studio projects from the command line.
section: References
category: CLI
categoryOrder: 1
order: 2
---

## pstdio projects create [name]

Create a new project and initialize `.pstdio/` in the current directory.

**Positional args:**

- `name` (optional) — project name. Defaults to the current folder name.

**Options:**

- `--repo <path>` (repeatable) — path(s) to git repos to connect. Defaults to the current git repo when omitted.

**Example:**

```bash
pstdio projects create monorepo-app --repo ../app --repo ../api
```

**SDK equivalent:** `client.projects.create(input)` → `POST /v1/projects`.

## pstdio projects list

List all projects.

No options.

**SDK equivalent:** `client.projects.list()` → `GET /v1/projects`.

## pstdio projects view

Show project details.

**Options:**

- `--project-id <id>` — project to view. Falls back to the current project.

**SDK equivalent:** `client.projects.get(projectId)`.

## pstdio projects link

Link the current git root to an existing project (writes `.pstdio/config.json`).

**Options:**

- `--project-id <id>` (required) — project id to link.

## pstdio projects unlink

Remove `.pstdio/config.json` from the current repo. The project itself is not deleted.

No options.

## pstdio projects repos

List repositories linked to a project.

**Options:**

- `--project-id <id>` — project id. Falls back to the current project.

**SDK equivalent:** `client.projects.listRepos(projectId)` → `GET /v1/projects/{id}/repos`.

## pstdio projects delete &lt;project-id&gt;

Delete a project.

**Positional args:**

- `project-id` (required) — the project id to delete.

**SDK equivalent:** `client.projects.delete(projectId)` → `DELETE /v1/projects/{id}`.

## Related pages

- [Create your first project](/docs/start/create-first-project/).
- [`client.projects` reference](/docs/reference/sdk/client/#clientprojects).
