import { defineCommand, l10n, params } from "@pstdio/sdk/extensions";
import { proposalRefinedKey } from "../notifications/dedupe-keys";

export const approveProposalCommand = defineCommand({
  title: l10n("commands.approveProposal.title", "Approve ticket proposal"),
  params: {
    ticketId: params.text({ label: "Ticket ID", required: true }),
  },
  async run(ctx) {
    await ctx.notify.resolve({ dedupeKey: proposalRefinedKey(ctx.params.ticketId) });
    return { ticketId: ctx.params.ticketId, status: "approved" as const };
  },
});
