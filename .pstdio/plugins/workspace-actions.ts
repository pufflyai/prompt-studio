import { spawnSync } from "node:child_process";
import { createSession, definePlugin } from "@pstdio/sdk/plugins";

export default definePlugin({
  actions: [
    // ──────────────────────────────────────────────────────────
    // Creates a manual code-review session
    // scoped to the selected workspace.
    // ──────────────────────────────────────────────────────────
    {
      key: "run-review",
      label: "Run review",
      targetType: "workspace",
      placement: "secondary",
      params: [{ key: "agent", label: "Agent", type: "agent" }],
      async trigger(ctx) {
        const agent = ctx.params.agent as { agent: string; model: string } | undefined;
        const ticketId = ctx.target.ticket_shorthand as string;

        const session = await createSession(ctx, {
          workspace_id: ctx.target.id,
          title: `Code review: ${ticketId ?? "ticket"}`,
          agent: agent?.agent,
          model: agent?.model,
          template: "code-review",
          vars: { ticket: ticketId },
        });

        return { session_id: session.id };
      },
    },
    {
      key: "open-worktree-in-vscode",
      label: "Open in VS Code",
      targetType: "workspace",
      placement: "overflow",
      trigger(ctx) {
        if (!ctx.target.worktree_path) {
          throw new Error("Workspace has no worktree path");
        }

        const result = spawnSync("code", [ctx.target.worktree_path]);
        if (result.error) {
          throw new Error("Failed to open VS Code. Ensure `code` is installed and available in PATH.");
        }
      },
    },
  ],
});
