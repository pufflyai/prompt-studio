import { defineCommand } from "@pstdio/sdk/extensions";
import { listOwnedTemplates } from "../data/template-store";

export const listTicketTemplatesCommand = defineCommand({
  id: "list-ticket-templates",
  title: "List ticket templates",
  cli: {
    globalAliases: [["tickets", "templates"]],
    examples: ["pstdio tickets templates"],
  },
  async run(ctx) {
    return (await listOwnedTemplates(ctx, "ticket")).map((template) => template.name);
  },
});
