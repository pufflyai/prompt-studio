---
layout: ../../../../layouts/docs-layout.astro
title: pstdio tags
description: Reference for the pstdio tags command group.
htmlTitle: pstdio tags CLI
htmlDescription: Manage tag dimensions on a Prompt Studio project from the command line.
section: References
category: CLI
categoryOrder: 1
order: 8
---

## pstdio tags list

List tag definitions.

No options.

**SDK equivalent:** `client.tags.list(projectId)` → `GET /v1/projects/{projectId}/ticket-tags`.

## pstdio tags create

Create a tag definition.

**Options:**

- `--name <string>` (required).
- `--type single_select | multi_select` — default `single_select`.

**SDK equivalent:** `client.tags.create(projectId, input)`.

## pstdio tags delete

Delete a tag.

**Options:**

- `--name <string>` (required).

**SDK equivalent:** `client.tags.delete(projectId, tagId)`.

## Tag options

Tag **options** (the actual pickable values) are managed through the SDK or dashboard. There are no CLI subcommands for options.

```ts
await client.tags.createOption(projectId, tagId, { name: "urgent", color: "red" });
await client.tags.updateOption(projectId, tagId, optionId, { color: "orange" });
await client.tags.deleteOption(projectId, tagId, optionId);
```

## Related pages

- [Configure statuses, tags, and skills](/docs/customization/project-configuration/).
- [`client.tags` reference](/docs/reference/sdk/client/#clienttags).
