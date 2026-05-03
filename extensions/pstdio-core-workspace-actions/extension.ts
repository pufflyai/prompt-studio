import { defineExtension, params, workspaceSlots } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "pstdio.core-workspace-actions",
  namespace: "core-workspace-actions",
  name: "Core Workspace Actions",
  version: "0.1.0",
  description: "Workspace-targeted commands migrated from the legacy workspace-actions plugin.",

  commands: {
    // Legacy action: { key: "run-review", targetType: "workspace", placement: "secondary", trigger(ctx) { ... } }
    "run-review": {
      title: "Run review",
      description: "Create a manual code-review session scoped to the selected workspace.",
      // TODO(slot): no kernel "secondary" workspace slot exists; using overflow until one is added.
      menus: [{ slot: workspaceSlots.headerOverflow, label: "Run review" }],
      params: {
        agent: params.harness({ label: "Agent" }),
      },
      async run(ctx) {
        // TODO(resource): the legacy plugin received the workspace via `ctx.target.id`
        // and `ctx.target.ticket_shorthand`. Once `ctx.resource` carries the workspace
        // metadata for workspace-targeted commands, wire those fields here.
        const workspaceId = ctx.resource?.id;
        if (!workspaceId) return;

        const harness = ctx.params.agent;

        await ctx.sessions.create({
          workspaceId,
          title: "Code review",
          template: "review-code",
          harness,
          // TODO(vars): once the workspace resource exposes `ticket_shorthand`,
          // pass `vars: { ticket: <shorthand> }` like the legacy plugin did.
        });
      },
    },
  },
});
