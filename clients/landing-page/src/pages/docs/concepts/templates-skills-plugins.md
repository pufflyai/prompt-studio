---
layout: ../../../layouts/docs-layout.astro
title: Templates, skills, and plugins
description: The three extension points that let you shape how Prompt Studio runs inside your project.
htmlTitle: Templates, skills, and plugins
htmlDescription: The three extension points — templates, skills, and plugins — that shape how Prompt Studio runs in your repo.
section: Guide
category: Core Concepts
categoryOrder: 2
order: 7
---

## Templates

Templates are named markdown documents with variables. They come in three types:

- **`ticket`** — used when creating a draft ticket. Filled in `pstdio tickets write` or the dashboard "new ticket" modal.
- **`prompt`** — used when launching a session. Filled by `pstdio sessions create --template` or follow-ups.
- **`document`** — used to scaffold project documents (for example a proposal or an ADR).

Every project starts with bundled defaults from `packages/pstdio/files/templates/`. You can create your own:

```bash
pstdio templates create \
  --name proposal \
  --type ticket \
  --file .pstdio/templates/proposal.md \
  --default
```

Write a template somewhere:

```bash
pstdio templates write --name proposal --ticket PS-42 --var area=api
```

## Skills

Skills are scoped agent instructions that Prompt Studio installs into your configured agents. They live under `packages/pstdio-agents/files/skills/` in the repo and under your agent's config directory after `pstdio agents setup`.

Each skill is a folder containing a `SKILL.md` plus optional references and examples. Skills are what tell an agent how to run specialized workflows — for example how to create a pstdio plugin, how to refine a ticket, or how to implement a ticket end-to-end.

View installed skills per project at **Settings → Skills** or list them:

```bash
curl http://localhost:19840/v1/projects/<project-id>/skills
```

## Plugins

Plugins extend Prompt Studio itself — not the underlying agent. A plugin is a TypeScript or JavaScript file under `.pstdio/plugins/` that calls `definePlugin(...)` and exports:

- **Hooks** — reactions to lifecycle events (ticket creation, worktree create, pre-commit, etc.).
- **Actions** — user-triggered commands shown on tickets, workspaces, or sessions.
- **Schedules** — cron-driven background jobs.

Register plugins for a project:

```bash
pstdio plugins list
pstdio plugins register
```

Plugins show up under **Settings → Plugins**:

![Plugins settings panel](/images/docs/project-settings-plugins.png)

## Related pages

- [Use templates](/docs/customization/configure-templates/) — practical template usage.
- [Use plugin actions](/docs/automation/plugin-actions/) — add custom buttons.
- [Use hooks](/docs/automation/hooks/) — react to lifecycle events.
- [Create a pstdio plugin](https://github.com/pufflyai/prompt-studio) — skill with end-to-end guidance.
