import { createSession, definePlugin, workspacesForTicket } from "@pstdio/sdk/plugins";

const buildPullRequestPrompt = (input: { ticketShorthand: string; ticketTitle: string; branch: string | null }) =>
  [
    "Use the GitHub CLI (`gh`) to open a pull request for this workspace.",
    "",
    `Ticket: ${input.ticketShorthand}`,
    `Title: ${input.ticketTitle}`,
    input.branch ? `Branch: ${input.branch}` : null,
    "",
    "Push the branch if needed, create the pull request, and reply with the PR URL.",
  ]
    .filter((line) => line !== null)
    .join("\n");

export default definePlugin({
  hooks: {
    async postTicketStatusChange(ctx) {
      if (ctx.toStatus !== "done") return;

      const workspaces = await workspacesForTicket(ctx, { ticketId: ctx.id });
      const reviewedWorkspaces = workspaces.filter((workspace) => workspace.attempt_status_name === "reviewed");

      for (const workspace of reviewedWorkspaces) {
        await createSession(ctx, {
          workspace_id: workspace.id,
          title: `Open PR: ${workspace.workspace_shorthand}`,
          prompt: buildPullRequestPrompt({
            ticketShorthand: ctx.shorthand,
            ticketTitle: ctx.displayTitle ?? ctx.shorthand,
            branch: workspace.branch,
          }),
        });
      }
    },
  },
});
