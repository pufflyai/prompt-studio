# Extensions Cookbook

This cookbook shows the target authoring model for Prompt Studio extensions.

## Add a Command

```ts
import { defineExtension, params } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "project.ops",
  name: "Ops",
  commands: {
    summarize: {
      title: "Summarize Project",
      target: "project",
      params: {
        focus: params.text({ label: "Focus" }),
      },
      cli: {
        path: "ops summarize",
        description: "Create a project summary",
      },
      async run(ctx) {
        await ctx.sessions.create({
          title: "Project summary",
          prompt: String(ctx.params.focus ?? "Summarize this project."),
          anchors: [ctx.target],
        });
      },
    },
  },
});
```

## Use Planner-Owned Ticket Management

Ticket management is planner-owned. Planner SDK helpers replace the useful ticket-file and ticket-status helpers from the existing bundled plugins.

```ts
import { defineExtension, params } from "@pstdio/sdk/extensions";
import { findTicketByRef, saveTicket, setTicketStatus } from "@pstdio/pstdio-ext-planner/sdk";

export default defineExtension({
  id: "project.ticket-workflow",
  name: "Ticket Workflow",
  commands: {
    saveTicket: {
      title: "Save ticket",
      target: "ticket",
      params: {
        rootPath: params.text({ label: "Root path", required: true }),
      },
      async run(ctx) {
        const ticket = await findTicketByRef(ctx, { ticketId: ctx.target.id });
        if (!ticket) return;

        await saveTicket(ctx, {
          rootPath: String(ctx.params.rootPath),
          ticketId: ticket.shorthand,
        });
      },
    },
  },
});

export const onSessionStart = async (ctx) => {
  if (!ctx.ticket) return;
  await setTicketStatus(ctx, { ticket: ctx.ticket.shorthand, status: "wip" });
};

export const onReviewReady = async (ctx) => {
  if (!ctx.worktreePath || !ctx.ticket) return;
  await saveTicket(ctx, { rootPath: ctx.worktreePath, ticketId: ctx.ticket.shorthand });
};
```

Planner helpers do not come from `@pstdio/sdk`. Session and attempt orchestration are not planner SDK helpers; use core clients or command runtime APIs for those flows.

## Add a Workspace Tab

Workspace page slots are owned by the workspace shell extension.

```ts
import { defineExtension } from "@pstdio/sdk/extensions";
import { workspaceSlots } from "pstdio-ext-workspace-shell/contract";

export default defineExtension({
  id: "project.security",
  name: "Security",
  views: {
    securityTab: {
      type: "tab",
      label: "Security",
      target: "workspace",
      slot: workspaceSlots.tabs,
      component: () => import("./security-tab"),
      order: 300,
    },
  },
});
```

## Add Package Templates

Extension defaults are read-only package assets. Project-owned variations are stored through Prompt Studio storage.

```ts
import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "project.templates",
  name: "Project Templates",
  templateTypes: {
    runbook: {
      label: "Runbook",
    },
  },
  templates: {
    incidentRunbook: {
      title: "Incident Runbook",
      type: "runbook",
      source: packageAsset("../templates/incident-runbook.md", import.meta.url),
    },
  },
});
```

## Add an Artifact Mount

Artifact mounts are for repo-context files that AI coding tools should inspect or edit.

```ts
import { defineExtension } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "project.artifacts",
  name: "Artifacts",
  artifactMounts: {
    reports: {
      path: ".pstdio/reports",
      label: "Reports",
    },
  },
});
```

The kernel normalizes paths and prevents escaping the mount root.

## Verify

```bash
pstdio extensions check
pstdio <extension-command> --help
```

Expected evidence:

- The extension appears in diagnostics.
- CLI command help names the provider extension id.
- Stateful commands execute through the API command path.
