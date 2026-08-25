import { defineCommand, params } from "@pstdio/sdk/extensions";
import { fileNameFromPath, requireRepoFiles, ticketFilesDir, ticketFilesPattern } from "../data/draft-storage";
import { findTicket } from "../data/resolve";

// `pst tickets files`: compare a ticket's stored files against the local
// `.pstdio/tickets/<shorthand>/files/` directory so the user can see what is and
// isn't synced.
export const listTicketFilesCommand = defineCommand({
  title: "List ticket files",
  cli: { globalAliases: [["tickets", "files"]], examples: ["pstdio tickets files --id PS-1"] },
  params: { id: params.text({ required: true }) },
  async run(ctx, commandParams) {
    const repoFiles = requireRepoFiles(ctx.repoFiles);
    const ticket = await findTicket(ctx.storage, commandParams.id);
    if (!ticket) throw new Error(`Unknown ticket "${commandParams.id}"`);

    const stored = new Set((ticket.files ?? []).map((file) => file.name));
    const local = new Set(
      (await repoFiles.list(ticketFilesPattern(ticket.shorthand))).map((entry) =>
        fileNameFromPath(ticket.shorthand, entry.path),
      ),
    );

    return [...new Set([...stored, ...local])].sort().map((name) => ({
      file: name,
      storage: stored.has(name) ? "yes" : "no",
      local: local.has(name) ? "yes" : "no",
      path: `${ticketFilesDir(ticket.shorthand)}/${name}`,
    }));
  },
});
