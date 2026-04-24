---
layout: ../../../layouts/docs-layout.astro
title: Use plugin actions
description: Expose custom commands on tickets, workspaces, and sessions through plugin actions.
htmlTitle: Use plugin actions
htmlDescription: Expose user-triggered commands on tickets, workspaces, and sessions through Prompt Studio plugins.
section: Guide
category: Automation
categoryOrder: 5
order: 3
---

## What an action is

An **action** is a user-triggered command that a plugin exposes to the dashboard and API. Each action has:

- **`key`** — stable id within the plugin.
- **`label`** — button label shown in the UI.
- **`targetType`** — `"ticket"`, `"workspace"`, or `"session"`.
- **`placement`** — `"primary"`, `"secondary"`, or `"overflow"` — controls where it appears in the target header or menu.
- **`params`** — zero or more parameter definitions surfaced as a dialog when the user clicks the button.
- **`trigger`** — the function that runs when the user invokes the action.

## Minimal action

```ts
// .pstdio/plugins/review.ts
import { definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  key: "review",
  actions: [
    {
      key: "mark-review-ready",
      label: "Mark review ready",
      targetType: "workspace",
      placement: "primary",
      trigger: async ({ client, targetId }) => {
        await client.workspaces.updateAttemptStatus(targetId, {
          status: "review-ready",
        });
      },
    },
  ],
});
```

Register the plugin:

```bash
pstdio plugins register
```

## Parameter types

Prompt Studio renders a dialog for actions that declare `params`. Supported types:

- **`text`** — single-line input.
- **`longtext`** — multiline textarea.
- **`select`** — dropdown with custom `options: [{ value, label }]`.
- **`template-select`** — dropdown populated from the project's templates filtered by `templateType`.
- **`agent`** — dropdown of configured agents.
- **`repo`** — dropdown of registered repos.

```ts
params: [
  { key: "message", label: "Follow-up message", type: "longtext", required: true },
  { key: "agent", label: "Agent", type: "agent", required: true },
  { key: "template", label: "Template", type: "template-select", templateType: "prompt" },
]
```

Parameter values are passed into the trigger as `ctx.params`.

## Trigger context

```ts
type ActionTriggerContext = {
  client: PstdioClient;
  projectId: string;
  prompts: Record<string, string>;   // rendered templates, keyed by template name
  params: Record<string, ActionParamValue>;
  targetType: "ticket" | "workspace" | "session";
  targetId: string;
  target: TicketListItem | WorkspaceListItem | Session;
};
```

Return `{ session_id?: string; message?: string }` to hint the dashboard — for example, to navigate the user to a session that was started.

## Invoke programmatically

Actions are also available through the SDK and the HTTP API:

```ts
await client.actions.execute(projectId, "review:mark-review-ready", {
  targetId: workspaceId,
  params: {},
});
```

## Related pages

- [`client.actions` reference](/docs/reference/sdk/client/#clientactions).
- [`definePlugin` reference](/docs/reference/sdk/plugins/).
- [Add project plugins](/docs/customization/add-plugins/) — how plugins are loaded.
