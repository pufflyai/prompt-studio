---
layout: ../../../../layouts/docs-layout.astro
title: pstdio templates
description: Reference for the pstdio templates command group.
htmlTitle: pstdio templates CLI
htmlDescription: List, create, edit, and remove project templates in Prompt Studio from the command line.
section: References
category: CLI
categoryOrder: 1
order: 9
---

## pstdio templates list

List templates for the current project.

No options.

**SDK equivalent:** `client.templates.list(projectId)`.

## pstdio templates create

Create a template.

**Options:**

- `--name <string>` (required) — unique within the project.
- `--type prompt | ticket | document` (required).
- `--file <path>` (required) — path to template markdown, or `-` for stdin.
- `--default` — mark as default for its type.

**SDK equivalent:** `client.templates.create(projectId, input)`.

## pstdio templates update

Update a template.

**Options:**

- `--name <string>` (required).
- `--file <path>` — path to new content, or `-` for stdin.
- `--default` — set as default for its type.

**SDK equivalent:** `client.templates.update(projectId, templateId, input)`.

## pstdio templates write

Write a template to a file or ticket.

**Options:**

- `--name <string>` (required) — template to render.
- `--target <path>` — destination path, relative to the current directory (overwrites).
- `--ticket <shorthand>` — write to `.pstdio/tickets/<shorthand>/ticket.md`, preserving the existing title.
- `--var key=value` (repeatable) — template variable.

## pstdio templates delete

Delete a template.

**Options:**

- `--name <string>` (required).

**SDK equivalent:** `client.templates.delete(projectId, templateId)`.

## Related pages

- [Use templates](/docs/customization/configure-templates/).
- [`client.templates` reference](/docs/reference/sdk/client/#clienttemplates).
