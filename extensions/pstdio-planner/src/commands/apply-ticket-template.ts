import { defineCommand, params, type TemplateParam } from "@pstdio/sdk/extensions";
import { renderPrompt } from "@pstdio/sdk/prompts";
import {
  readTicketMarkdown,
  requireTicketDraftFiles,
  ticketMarkdownPath,
  writeTicketMarkdown,
} from "../data/draft-storage";
import { extractTicketTitle } from "../data/frontmatter";
import { findTicket } from "../data/resolve";
import { readOwnedTemplate } from "../data/template-store";
import { refreshTicketCheckout } from "../data/ticket-checkout";

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
    template: { type: "template", templateType: "ticket", required: true } as TemplateParam<true>,
    var: params.list(),
  },
  async run(ctx, commandParams) {
    const { projectFiles, resolvePath } = await requireTicketDraftFiles(ctx);
    const ticket = await findTicket(ctx, commandParams.id);
    if (!ticket) throw new Error(`Unknown ticket "${commandParams.id}"`);
    await refreshTicketCheckout(projectFiles, ticket);
    const current = await readTicketMarkdown(projectFiles, ticket.shorthand);
    if (current === null) throw new Error(`Ticket not found: ${commandParams.id}`);

    const template = await readOwnedTemplate(ctx, commandParams.template);
    if (!template) throw new Error(`Template not found: ${commandParams.template}`);
    if (template.type !== "ticket") throw new Error(`Template is not a ticket template: ${commandParams.template}`);

    const path = ticketMarkdownPath(ticket.shorthand);
    await writeTicketMarkdown(
      projectFiles,
      ticket,
      renderPrompt(template.content, {
        CREATED_AT: new Date().toISOString(),
        USER_PROMPT: "",
        PARENT_ID: "",
        TICKET_ID: ticket.shorthand,
        TICKET_TITLE: extractTicketTitle(current) ?? commandParams.id,
        ...parseVariables(commandParams.var),
      }),
    );
    return { shorthand: ticket.shorthand, path: resolvePath(path) };
  },
});
