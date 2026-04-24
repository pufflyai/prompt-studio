import { defineExtension, packageAsset } from "@pstdio/sdk/extensions";

export default defineExtension({
  id: "local.templates",
  name: "Templates",
  templateTypes: {
    ticket: {
      label: "Ticket",
      description: "Templates used for ticket creation and refinement.",
    },
  },
  templates: {
    defaultTicket: {
      title: "Default Ticket",
      type: "ticket",
      source: packageAsset("../templates/default-ticket.md", import.meta.url),
    },
  },
  initialSetup: async (ctx) => {
    const statuses = await ctx.storage.collection("statuses").list();
    if (statuses.length > 0) return;

    await ctx.storage.collection("statuses").put("backlog", {
      id: "backlog",
      label: "Backlog",
      order: 100,
    });
  },
});
