import { defineCommand, params } from "@pstdio/sdk/extensions";
import { renderPrompt } from "@pstdio/sdk/prompts";
import { readTicketMarkdown, requireRepoFiles, ticketMarkdownPath, writeTicketText } from "../data/draft-storage";
import { extractTicketTitle } from "../data/frontmatter";
import { readOwnedTemplate } from "../data/template-store";

const parseVariables = (values: string[] | undefined) => {
  const variables: Record<string, string> = {};
  for (const value of values ?? []) {
    const separator = value.indexOf("=");
    if (separator < 0) throw new Error(`Invalid --var format: "${value}". Expected key=value.`);
    variables[value.slice(0, separator)] = value.slice(separator + 1);
  }
  return variables;
};

export const applyTicketTemplateCommand = defineCommand({
  id: "apply-ticket-template",
  title: "Apply template to ticket",
  mutating: true,
  cli: {
    globalAliases: [["tickets", "apply-template"]],
    examples: ["pstdio tickets apply-template --id PS-1 --template proposal"],
  },
  params: {
    id: params.text({ required: true }),
    template: params.text({ required: true }),
    var: params.list(),
  },
  async run(ctx, commandParams) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const current = await readTicketMarkdown(repoFiles, commandParams.id);
    if (current === null) throw new Error(`Ticket not found: ${commandParams.id}`);

    const template = await readOwnedTemplate(ctx, commandParams.template);
    if (!template) throw new Error(`Template not found: ${commandParams.template}`);
    if (template.type !== "ticket") throw new Error(`Template is not a ticket template: ${commandParams.template}`);

    const path = ticketMarkdownPath(commandParams.id);
    await writeTicketText(
      repoFiles,
      commandParams.id,
      renderPrompt(template.content, {
        CREATED_AT: new Date().toISOString(),
        USER_PROMPT: "",
        PARENT_ID: "",
        TICKET_ID: commandParams.id,
        TICKET_TITLE: extractTicketTitle(current) ?? commandParams.id,
        ...parseVariables(commandParams.var),
      }),
    );
    return { shorthand: commandParams.id, path };
  },
});
