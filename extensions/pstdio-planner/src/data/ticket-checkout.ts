import type { ArtifactMount } from "@pstdio/sdk/extensions";
import { TICKETS_DIR, ticketMarkdownPath } from "./draft-storage";
import { parseTicketFrontmatter } from "./frontmatter";
import type { Ticket } from "./types";

export const moveTicketCheckout = async (files: ArtifactMount, ticket: Ticket, previousShorthand: string) => {
  if (previousShorthand === ticket.shorthand) return;
  const oldPath = ticketMarkdownPath(previousShorthand);
  if (!(await files.exists(oldPath))) return;
  const markdown = await files.readText(oldPath);
  // The same number can belong to a different ticket on this device.
  if (parseTicketFrontmatter(markdown).resourceId !== ticket.id) return;
  const source = `${TICKETS_DIR}/${previousShorthand}`;
  const destination = `${TICKETS_DIR}/${ticket.shorthand}`;
  const entries = await files.list(`${source}/**`);
  const updated = markdown.replace(/^ticket_id:.*$/m, `ticket_id: ${JSON.stringify(ticket.shorthand)}`);
  for (const entry of entries) {
    const path = destination + entry.path.slice(source.length);
    const bytes = entry.path === oldPath ? new TextEncoder().encode(updated) : await files.readBytes(entry.path);
    if (await files.exists(path)) {
      const existing = await files.readBytes(path);
      if (existing.length !== bytes.length || existing.some((byte, index) => byte !== bytes[index]))
        throw new Error(`Ticket checkout already has different local edits: ${path}`);
    } else await files.writeBytes(path, bytes);
  }
  // Keep every source file until the complete checkout has been copied successfully.
  await files.delete(source);
};

export const refreshTicketCheckout = async (files: ArtifactMount, ticket: Ticket) => {
  for (const previous of ticket.aliases ?? []) await moveTicketCheckout(files, ticket, previous);
};
