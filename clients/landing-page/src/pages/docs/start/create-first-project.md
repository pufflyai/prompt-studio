---
layout: ../../../layouts/docs-layout.astro
title: Create your first project
description: Register a project, attach repositories, and understand the local config file.
htmlTitle: Create your first project
htmlDescription: Create a Prompt Studio project, attach git repos, and learn what gets written to the .pstdio config folder.
section: Guide
category: Start
categoryOrder: 1
order: 3
---

## Create the project

A Prompt Studio project is a database record with an `id`, a human name, and a short code ("shorthand", e.g. `PS`) used to prefix ticket ids.

```bash
pstdio projects create my-project --repo .
```

- If you omit `name`, the current folder name is used.
- Pass `--repo` one or more times to register git repositories. By default the current git repo is registered when omitted.

Register several repos at once:

```bash
pstdio projects create monorepo-app --repo ../app --repo ../api --repo ../docs
```

## What gets written locally

After `projects create`, the CLI writes `.pstdio/config.json` in your current repo:

```json
{
  "project_id": "4a674735-3b7d-4dcb-8b71-42f1b7d4a9d2"
}
```

This file tells CLI commands which project they belong to when you run them from that repo. You will also see `.pstdio/tickets/` appear once you start pulling or writing tickets locally.

## Link an existing project

To bind a checkout of another repo to an existing project:

```bash
pstdio projects link --project-id <project-id>
```

To remove the binding:

```bash
pstdio projects unlink
```

## Inspect repos

```bash
pstdio projects repos
```

Lists each repo registered under the current project with its path and default branch.

## Delete a project

```bash
pstdio projects delete <project-id>
```

Marks the project as deleted server-side. Local `.pstdio/` files are not removed automatically — remove them with your usual file tools when you no longer need them.

## Related pages

- [Local ticket files](/docs/workflows/local-ticket-files/) — what appears under `.pstdio/tickets/`.
- [`pstdio projects` reference](/docs/reference/cli/projects/) — every option.
