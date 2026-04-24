---
layout: ../../../../layouts/docs-layout.astro
title: pstdio plugins
description: Reference for the pstdio plugins command group.
htmlTitle: pstdio plugins CLI
htmlDescription: Register, list, and unregister project plugins in Prompt Studio from the command line.
section: References
category: CLI
categoryOrder: 1
order: 10
---

## pstdio plugins list

List registered plugins for the project.

**Options:**

- `--project-id <id>`.

**SDK equivalent:** `client.projects.listPlugins(projectId)` → `GET /v1/projects/{id}/plugins`.

## pstdio plugins register

Force plugin registration (re-scan `.pstdio/plugins/`).

**Options:**

- `--project-id <id>`.

**SDK equivalent:** `client.projects.registerPlugins(projectId)` → `POST /v1/projects/{id}/plugins/register`.

## When to run register

Plugin files are rescanned automatically when the API notices changes. Trigger a manual register when:

- You just created a new plugin file.
- You edited a plugin and the dashboard still shows stale metadata.
- You deleted a plugin and want it purged from the registry.

## Related pages

- [Add project plugins](/docs/customization/add-plugins/).
- [`definePlugin` reference](/docs/reference/sdk/plugins/).
