---
layout: ../../../layouts/docs-layout.astro
title: Configure statuses, tags, and skills
description: Tune ticket statuses, attempt statuses, tags, and the agent skills bundled with the project.
htmlTitle: Project configuration
htmlDescription: Configure ticket and attempt statuses, tag dimensions, and agent skills in Prompt Studio.
section: Guide
category: Customization
categoryOrder: 6
order: 2
---

## Two status dimensions

Prompt Studio tracks work on two axes:

- **Ticket status** — where the work is in your team's workflow. Defaults: `backlog`, `ready`, `wip`, `blocked`, `review`, `done`.
- **Attempt status** — where a specific attempt is in the session loop. Defaults: `wip`, `blocked`, `review-ready`, `reviewed`, `changes-requested`.

Status names are the exact strings you pass to the SDK and CLI. They use hyphens, not underscores or spaces.

## Ticket statuses

```bash
pstdio statuses list
pstdio statuses create --name "in-review" --color blue
pstdio statuses set-default --name "backlog"
pstdio statuses delete --name "old-status"
```

Available colors: `gray`, `red`, `orange`, `amber`, `yellow`, `lime`, `green`, `teal`, `cyan`, `blue`, `indigo`, `violet`, `purple`, `pink`, `rose`.

Exactly one status can be the project default. New tickets land in the default unless they specify `--status`.

## Attempt statuses

Managed from the dashboard (**Settings → Attempt Statuses**) or the SDK:

```ts
await client.statuses.listAttemptStatuses(projectId);
await client.statuses.createAttemptStatus(projectId, {
  name: "qa-ready",
  color: "blue",
  sort_order: 20,
});
await client.statuses.updateAttemptStatus(projectId, statusId, { is_default: true });
```

## Roll attempt status up to the ticket

Bump a ticket status when every attempt reaches a given state:

```bash
pstdio tickets update-when-attempt-status \
  --id PS-1 \
  --all-attempts-status reviewed \
  --set-status done
```

The same rollup is available from a plugin with `updateTicketWhenAllAttemptsMatch`.

## Delete rules

- You cannot delete a status that is still the default.
- You cannot delete a status that is still assigned to tickets or attempts. Reassign first.

## Tags

Tags are project-scoped labels. They come in two levels:

1. **Tag dimension** — a named axis (e.g. `priority`, `area`). Created once per project.
2. **Options** — the values users assign on that dimension (e.g. `urgent`, `frontend`). Tickets carry options, not dimension names.

When you pass `--tag urgent` or `tag_names: ["urgent"]`, Prompt Studio matches the string against option names across every dimension.

### Create a tag dimension

```bash
pstdio tags create --name priority --type single_select
pstdio tags create --name area --type multi_select
```

`--type` is `single_select` (one option per ticket on that axis) or `multi_select` (many). Default is `single_select`.

### Add options

Options are what users actually pick. Create them from the dashboard (**Settings → Tags**) or the SDK:

```ts
await client.tags.createOption(projectId, priorityTagId, {
  name: "urgent",
  color: "red",
});

await client.tags.updateOption(projectId, tagId, optionId, { color: "orange" });
await client.tags.deleteOption(projectId, tagId, optionId);
```

### Assign options to tickets

```bash
pstdio tickets update --id PS-42 --tag urgent --tag frontend
```

```ts
await client.tickets.update(ticketId, { tag_names: ["urgent", "frontend"] });
```

`tag_names` replaces the entire tag set — pass the full list you want the ticket to have.

### Delete a tag

```bash
pstdio tags delete --name area
```

Deleting a tag removes it from every ticket that carried it.

## Filter by status and tag

```bash
pstdio tickets list --status wip --tag frontend --tag urgent
```

## Skills

Skills are scoped agent instructions Prompt Studio installs into each configured agent. They teach the agent how to work with Prompt Studio — how to implement a ticket, refine one, write a plugin, and so on.

Skills are installed per-agent by `pstdio agents setup <agent>`. Use `--global-skills` to install them into the agent's global config instead of the project's `.pstdio/`.

### Refresh bundled skills

Re-copy the shipped skills after upgrading the CLI:

```bash
pstdio agents install-skills claude-code
pstdio agents install-skills claude-code --global-skills
```

### Write your own skill

Drop a folder under your agent's skills directory:

```text
<skills-dir>/my-skill/
  SKILL.md            # the instructions
  references/
    context.md        # extra context
```

The skill appears on next sync. See the bundled `create-pstdio-plugin` skill under `packages/pstdio-agents/files/skills/` for a worked example.

## Related pages

- [Configure agents](/docs/customization/configure-agents/).
- [Templates, skills, and plugins](/docs/concepts/templates-skills-plugins/).
- [`pstdio statuses` reference](/docs/reference/cli/statuses/), [`pstdio tags` reference](/docs/reference/cli/tags/).
