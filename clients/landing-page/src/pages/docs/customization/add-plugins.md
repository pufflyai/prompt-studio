---
layout: ../../../layouts/docs-layout.astro
title: Add project plugins
description: Drop TypeScript files into .pstdio/plugins to register hooks, actions, and schedules.
htmlTitle: Add project plugins
htmlDescription: Drop TypeScript plugins into .pstdio/plugins to register hooks, actions, and schedules in Prompt Studio.
section: Guide
category: Customization
categoryOrder: 6
order: 4
---

## Layout

Plugins live under `.pstdio/plugins/` inside your project:

```text
.pstdio/plugins/
  guardrails.ts
  digest/
    index.ts
    helpers.ts
```

Both TypeScript (`.ts`, `.mts`) and JavaScript (`.js`, `.mjs`) files are supported. Directories with an `index.ts` or `index.js` count as a single plugin.

## Minimal plugin

```ts
// .pstdio/plugins/guardrails.ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  key: "guardrails",
  hooks: {
    preTicketStatusChange: async (ctx) => {
      if (ctx.toStatus === "done" && !ctx.tagNames.includes("reviewed")) {
        return { reject: true, reason: "Ticket must be reviewed first." };
      }
    },
  },
});
```

## Identity rules

- `key` is optional. If omitted, Prompt Studio derives one from the file name.
- Keys must be unique across the project. Two files exporting the same `key` is an error.
- Each plugin's `actions[].key` must be unique within the plugin.

## Register

Registration happens automatically on project open if the API discovers new or changed files. Force it manually when you edit a plugin:

```bash
pstdio plugins register
pstdio plugins list
```

The HTTP API equivalents are `POST /v1/projects/{id}/plugins/register` and `GET /v1/projects/{id}/plugins`.

## Dashboard

Registered plugins show under **Settings → Plugins**. Each row shows the plugin's actions, hooks, and schedules.

![Plugins panel](/images/docs/project-settings-plugins.png)

## Using helpers

Plugin helpers (see [Plugin helpers](/docs/reference/sdk/plugins/#plugin-helpers)) let you do useful work from inside a handler without writing raw SDK calls. Common ones:

- `saveTicket` / `pullTickets` — sync local markdown with the server.
- `createAttempt` / `createSession` / `createWorkspace` — spawn new work.
- `setTicketStatus`, `setWorkspaceAttemptStatus` — mutate status by name.
- `runCommand` — run a shell command from a worktree.
- `bootstrapWorktree` — copy repo config into a new worktree.

## Related pages

- [Use hooks](/docs/automation/hooks/).
- [Use plugin actions](/docs/automation/plugin-actions/).
- [Use schedules](/docs/automation/schedules/).
- [`definePlugin` reference](/docs/reference/sdk/plugins/).
