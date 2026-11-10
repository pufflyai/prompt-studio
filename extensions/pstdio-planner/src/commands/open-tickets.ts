import { defineCommand, l10n } from "@pstdio/sdk/extensions";
import { ticketsPageTarget } from "../data/ticket-page-target";

export const openTicketsCommand = defineCommand({
  id: "open-tickets",
  title: l10n("commands.openTickets", "Open tickets"),
  palette: [{ group: "Tickets", icon: "square-kanban" }],
  run(ctx) {
    ctx.navigation.open(ticketsPageTarget);
  },
});
