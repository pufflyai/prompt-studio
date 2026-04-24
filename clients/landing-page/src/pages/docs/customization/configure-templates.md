---
layout: ../../../layouts/docs-layout.astro
title: Use templates
description: Reusable markdown scaffolds for tickets, prompts, and documents, with Mustache-style variables.
htmlTitle: Use templates
htmlDescription: Define and render reusable markdown scaffolds for tickets, prompts, and documents in Prompt Studio.
section: Guide
category: Customization
categoryOrder: 6
order: 3
---

## Template types

- **`ticket`** — seeds new drafts. Used by the dashboard's new-ticket modal and `pstdio tickets write`.
- **`prompt`** — seeds session prompts. Used by `pstdio sessions create --template` and follow-ups.
- **`document`** — scaffolds standalone markdown files via `pstdio templates write`.

New projects inherit bundled defaults from `packages/pstdio/files/templates/` (ticket, proposal, prompt, and document templates). They appear in **Settings → Templates** the first time the project is used.

## Override a bundled template

Create your own with the same `name` and `type`:

```bash
pstdio templates create \
  --name default \
  --type ticket \
  --file .pstdio/templates/ticket.md \
  --default
```

Use `--file -` to pipe content from stdin:

```bash
cat proposal.md | pstdio templates create --name proposal --type ticket --file -
```

## Variables

Templates use Mustache-style `{{variable}}` substitution. Given:

```markdown
# {{title}}

## Context
{{context}}

## Acceptance
- [ ] {{acceptance}}
```

Render it with:

```bash
pstdio templates write \
  --name proposal \
  --ticket PS-42 \
  --var title="Add onboarding empty states" \
  --var context="Users with no projects see a blank screen." \
  --var acceptance="Empty state shows the quickstart link"
```

`--ticket` writes into `.pstdio/tickets/PS-42/ticket.md` and preserves the existing title. Write to an arbitrary file instead:

```bash
pstdio templates write --name proposal --target docs/proposals/new.md --var title=...
```

## Default per type

One default template per type (ticket, prompt, document). The default is used when the dashboard's new-ticket modal opens without an explicit pick and when CLI commands resolve a template name.

## Update and delete

```bash
pstdio templates update --name proposal --file .pstdio/templates/proposal.md --default
pstdio templates delete --name proposal
```

## Programmatic use

```ts
import { renderPrompt } from "@pstdio/sdk/prompts";

const body = renderPrompt(template, { title: "Add onboarding empty states" });
```

Use `client.templates` to fetch and mutate templates server-side.

## Related pages

- [`pstdio templates` reference](/docs/reference/cli/templates/).
- [`client.templates` reference](/docs/reference/sdk/client/#clienttemplates).
- [Templates, skills, and plugins](/docs/concepts/templates-skills-plugins/).
