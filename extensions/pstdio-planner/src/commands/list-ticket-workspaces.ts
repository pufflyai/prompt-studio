import { defineCommand, params } from "@pstdio/sdk/extensions";
import { findTicket } from "../data/resolve";

// Lists the workspaces linked to a ticket by reading the ticket's own workspaceIds
// (ticket -> workspace) and hydrating each via the core workspaces api. This is the
// modern, extension-owned link; the legacy `ticket-workspaces` command reads the
// deprecated workspace -> ticket shorthand instead.
export const listTicketWorkspacesCommand = defineCommand({
  title: "List ticket workspaces",
  params: { ticket: params.text({ required: true }) },
  async run(ctx) {
    const ticket = await findTicket(ctx.storage, ctx.params.ticket);
    const ids = ticket?.workspaceIds ?? [];

    const hydrated = await Promise.all(ids.map((id) => ctx.workspaces.get(id)));
    const workspaces = hydrated
      .filter((ws): ws is NonNullable<typeof ws> => ws != null)
      .map((ws) => ({
        id: ws.id,
        shorthand: ws.workspace_shorthand ?? ws.id,
        branch: ws.branch ?? null,
        name: ws.name ?? null,
        initializing: ws.initializing ?? false,
      }));

    return { workspaces };
  },
});
