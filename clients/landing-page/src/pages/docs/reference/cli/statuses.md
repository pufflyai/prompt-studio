---
layout: ../../../../layouts/docs-layout.astro
title: pstdio statuses
description: Reference for the pstdio statuses command group.
htmlTitle: pstdio statuses CLI
htmlDescription: Manage ticket statuses on a Prompt Studio project from the command line.
section: References
category: CLI
categoryOrder: 1
order: 7
---

## pstdio statuses list

List ticket statuses for the current project.

No options.

**SDK equivalent:** `client.statuses.list(projectId)` → `GET /v1/projects/{projectId}/statuses`.

## pstdio statuses create

Create a ticket status.

**Options:**

- `--name <string>` (required).
- `--color <name>` (required) — one of: `gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`, `violet`, `purple`, `pink`, `rose`.
- `--default` — set as the default status.

**SDK equivalent:** `client.statuses.create(projectId, input)`.

## pstdio statuses set-default

Set a status as the default.

**Options:**

- `--name <string>` (required).

**SDK equivalent:** `client.statuses.setDefault(projectId, statusId)`.

## pstdio statuses delete

Delete a ticket status.

**Options:**

- `--name <string>` (required).

**SDK equivalent:** `client.statuses.delete(projectId, statusId)`.

## Related pages

- [Configure statuses, tags, and skills](/docs/customization/project-configuration/).
- [`client.statuses` reference](/docs/reference/sdk/client/#clientstatuses).
