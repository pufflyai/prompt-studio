import { defineCommand } from "@pstdio/sdk/extensions";

export const listTicketTemplatesCommand = defineCommand({
  id: "list-ticket-templates",
  title: "List ticket templates",
  cli: {
    globalAliases: [["tickets", "templates"]],
    examples: ["pstdio tickets templates"],
  },
  async run(ctx) {
    const names = ["ticket", "bug-fix", "proposal"];
    const templates = await Promise.all(names.map((name) => ctx.templates.get(name)));
    return templates.filter((template) => template?.template_type === "ticket").map((template) => template!.name);
  },
});
