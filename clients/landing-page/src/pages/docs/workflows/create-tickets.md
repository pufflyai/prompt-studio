---
layout: ../../../layouts/docs-layout.astro
title: Create and refine tickets
description: Three ways to create tickets and how to refine them before handing them to an agent.
htmlTitle: Create and refine tickets
htmlDescription: Three ways to create tickets in Prompt Studio and how to flesh them out before handing them to an agent.
section: Guide
category: Daily Workflow
categoryOrder: 3
order: 1
---

## Three starting points

### Dashboard — new ticket modal

Click **+** on the ticket board. Pick a template, fill in the title and body, add tags, and create. The first heading in the body becomes the ticket display title.

### CLI — directly in the database

For quick work from the shell:

```bash
pstdio tickets create --content "# Add onboarding empty states" --status backlog --tag frontend
```

`--content` accepts full markdown. Use a heredoc if it spans multiple lines:

```bash
pstdio tickets create --content "$(cat <<'EOF'
# Add onboarding empty states

Users with no projects see a blank screen. Render a helpful empty state with a link to the quickstart guide.
EOF
)"
```

### CLI — draft as a local file

When you want to iterate on the content with your editor first:

```bash
pstdio tickets write --title "Add onboarding empty states" --template proposal
```

`write` creates a **draft** ticket and a local file at `.pstdio/tickets/<shorthand>/ticket.md`. Drafts don't show in the default ticket list. When you're happy, push it back:

```bash
pstdio tickets save --id <shorthand>
```

See [Use local ticket files](/docs/workflows/local-ticket-files/) for the full round-trip.

## Refine with templates

Templates (see [Templates, skills, and plugins](/docs/concepts/templates-skills-plugins/)) let you seed a new ticket with structure — a proposal format, a bug-report format, a spec format. Prompt Studio ships with a few defaults; add your own for team conventions.

## Refine with a refine session

For larger tickets, you can launch a session against the ticket to expand and structure its content:

1. Create a draft or seed ticket.
2. Launch a session with the **refine-ticket** skill installed.
3. The agent updates the ticket body based on your instructions.

Invoke it via the dashboard's plugin actions or with `pstdio sessions create --prompt "Refine PS-42"`.

## Ticket metadata

After creating, you can update metadata:

```bash
pstdio tickets update --id PS-42 --status ready --tag urgent
```

Available metadata mutations:

- **`--status <name>`** — change ticket status.
- **`--tag <name>`** (repeatable) — replace all tags with the supplied list.

## Related pages

- [Local ticket files](/docs/workflows/local-ticket-files/) — edit ticket markdown from your editor.
- [Attach files and artifacts](/docs/workflows/files-and-artifacts/) — add context files to a ticket.
- [`pstdio tickets` reference](/docs/reference/cli/tickets/) — full CLI.
