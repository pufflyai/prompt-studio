import { type ArtifactMount, defineCommand, type ExtensionStorageApi, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { requireRepoFiles, ticketFilesDir, ticketMarkdownPath, ticketToMarkdown } from "../data/draft-storage";
import { findTicket } from "../data/resolve";
import type { StoredTicket } from "../data/types";

const pullTicket = async (input: {
  storage: ExtensionStorageApi;
  projectFiles: ArtifactMount;
  ticket: StoredTicket;
  force: boolean;
}) => {
  const { projectFiles, ticket } = input;
  const markdownPath = ticketMarkdownPath(ticket.shorthand);

  // Without --force, never clobber local edits.
  if (!input.force && (await projectFiles.exists(markdownPath))) return { shorthand: ticket.shorthand, skipped: true };

  await projectFiles.writeText(markdownPath, await ticketToMarkdown(input.storage, ticket));
  for (const file of ticket.files ?? []) {
    await projectFiles.writeText(`${ticketFilesDir(ticket.shorthand)}/${file.name}`, file.content);
  }

  return { shorthand: ticket.shorthand, skipped: false, files: (ticket.files ?? []).length };
};

// `pst tickets pull`: materialize a ticket (or every non-archived ticket) from
// extension storage into the local `.pstdio/tickets/<shorthand>/` tree.
export const pullTicketCommand = defineCommand({
  id: "pull-ticket",
  mutating: true,
  title: "Pull ticket",
  cli: {
    globalAliases: [["tickets", "pull"]],
    examples: ["pstdio tickets pull --id PS-1", "pstdio tickets pull --force"],
  },
  params: {
    id: params.text(),
    force: params.boolean(),
  },
  async run(ctx, commandParams) {
    const projectFiles = requireRepoFiles(ctx.projectFiles);
    const force = commandParams.force ?? false;

    if (commandParams.id !== undefined) {
      const ticket = await findTicket(ctx.storage, commandParams.id);
      if (!ticket) throw new Error(`Unknown ticket "${commandParams.id}"`);
      return pullTicket({ storage: ctx.storage, projectFiles, ticket, force });
    }

    const tickets = (await ticketsCollection(ctx.storage).list()).filter((ticket) => !ticket.archived);
    const results = [];
    for (const ticket of tickets) {
      results.push(await pullTicket({ storage: ctx.storage, projectFiles, ticket, force }));
    }
    return { pulled: results.filter((result) => !result.skipped).length, total: tickets.length };
  },
});
