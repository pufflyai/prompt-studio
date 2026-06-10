import { type ArtifactMount, defineCommand, type ExtensionStorageApi, params } from "@pstdio/sdk/extensions";
import { ticketsCollection } from "../data/collections";
import { requireRepoFiles, ticketFilesDir, ticketMarkdownPath, ticketToMarkdown } from "../data/draft-storage";
import { findTicket } from "../data/resolve";
import type { StoredTicket } from "../data/types";

const pullTicket = async (input: {
  storage: ExtensionStorageApi;
  repoFiles: ArtifactMount;
  ticket: StoredTicket;
  force: boolean;
}) => {
  const { repoFiles, ticket } = input;
  const markdownPath = ticketMarkdownPath(ticket.shorthand);

  // Without --force, never clobber local edits.
  if (!input.force && (await repoFiles.exists(markdownPath))) return { shorthand: ticket.shorthand, skipped: true };

  await repoFiles.writeText(markdownPath, await ticketToMarkdown(input.storage, ticket));
  for (const file of ticket.files ?? []) {
    await repoFiles.writeText(`${ticketFilesDir(ticket.shorthand)}/${file.name}`, file.content);
  }

  return { shorthand: ticket.shorthand, skipped: false, files: (ticket.files ?? []).length };
};

// `pst tickets pull`: materialize a ticket (or every non-archived ticket) from
// extension storage into the local `.pstdio/tickets/<shorthand>/` tree.
export const pullTicketCommand = defineCommand({
  title: "Pull ticket",
  cli: {
    globalAliases: [["tickets", "pull"]],
    examples: ["pstdio tickets pull --id PS-1", "pstdio tickets pull --force"],
  },
  params: {
    id: params.text(),
    force: params.boolean(),
  },
  async run(ctx) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const force = ctx.params.force ?? false;

    if (ctx.params.id !== undefined) {
      const ticket = await findTicket(ctx.storage, ctx.params.id);
      if (!ticket) throw new Error(`Unknown ticket "${ctx.params.id}"`);
      return pullTicket({ storage: ctx.storage, repoFiles, ticket, force });
    }

    const tickets = (await ticketsCollection(ctx.storage).list()).filter((ticket) => !ticket.archived);
    const results = [];
    for (const ticket of tickets) {
      results.push(await pullTicket({ storage: ctx.storage, repoFiles, ticket, force }));
    }
    return { pulled: results.filter((result) => !result.skipped).length, total: tickets.length };
  },
});
