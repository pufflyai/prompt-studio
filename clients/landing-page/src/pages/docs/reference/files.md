---
layout: ../../../layouts/docs-layout.astro
title: Local files
description: Every file Prompt Studio reads or writes in your project and bundled defaults.
htmlTitle: Project file layout
htmlDescription: Every file Prompt Studio writes inside .pstdio/ in your project, plus the bundled defaults it ships.
section: References
category: Files
categoryOrder: 5
order: 1
---

## Inside a project

### `.pstdio/config.json`

Binds a git checkout to a Prompt Studio project.

```json
{
  "project_id": "<uuid>"
}
```

Written by `pstdio projects create` and `pstdio projects link`. Removed by `pstdio projects unlink`.

### `.pstdio/tickets/<shorthand>/ticket.md`

Markdown body with YAML frontmatter. Created and maintained by `pstdio tickets write`, `pstdio tickets save`, `pstdio tickets pull`. See [Local ticket files](/docs/workflows/local-ticket-files/) for the full format.

### `.pstdio/tickets/<shorthand>/files/`

User-uploaded files. Kept in sync with the server when you run `pstdio tickets save` and `pstdio tickets pull`.

### `.pstdio/tickets/<shorthand>/artifacts/`

Agent-generated outputs (logs, intermediate documents). Kept local only.

### `.pstdio/plugins/`

Your plugin files. TypeScript or JavaScript, default-export a `definePlugin(...)` call. See [Add project plugins](/docs/customization/add-plugins/).

### `.pstdio/docs/`

Optional project-scoped documentation — ADRs, architecture notes, lessons learned. Read by `refine-ticket` and `create-proposal` skills as extra context.

## Bundled defaults

Prompt Studio ships a set of defaults inside the `pstdio` package. They land in your project or agent config the first time they are needed — you don't need to copy them manually.

### Templates

Default ticket, proposal, prompt, and document templates. Copied into new projects on first use; override by creating your own template with the same `name` + `type`. See [Configure templates](/docs/customization/configure-templates/).

### Plugins

Shipped plugins (session bridges, attempt-status handlers, the OpenCode bridge) are installed by `pstdio agents setup` and, for project-scoped plugins, copied into `.pstdio/plugins/` when you opt in with `pstdio plugins register`.

### Skills

Skills like `create-pstdio-plugin` and `refine-ticket` are installed into each agent's config directory by `pstdio agents setup`.

## Runtime / workspaces

### Workspaces directory

Default: `$HOME/.pstdio/workspaces/`. Override with `PSTDIO_WORKSPACES_DIR`. Every `worktree`-mode workspace lives under `<workspaces-dir>/<project-shorthand>/<workspace-shorthand>/`.

### Database

The local SQLite database lives under `PSTDIO_DB_PATH` (default under Prompt Studio's storage folder). `:memory:` is supported for tests.

### Storage

`PSTDIO_STORAGE_PATH` controls where uploaded files live on disk. The API reads/writes there when you upload ticket files or serve file content.

## Related pages

- [Local ticket files](/docs/workflows/local-ticket-files/).
- [Add project plugins](/docs/customization/add-plugins/).
- [Environment reference](/docs/reference/environment/).
