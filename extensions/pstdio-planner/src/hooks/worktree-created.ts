import { existsSync } from "node:fs";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { defineHook, type ExtensionStorageApi, worktreeEvents } from "@pstdio/sdk/extensions";
import { ticketMarkdownPath, ticketToMarkdown } from "../data/draft-storage";
import { findTicket } from "../data/resolve";
import type { StoredTicket } from "../data/types";
import { ticketRefFromAnchors } from "../data/workspace-ticket-link";

const copyOrWriteTicketFile = async (input: {
  repoPath: string;
  storage: ExtensionStorageApi;
  ticket: StoredTicket;
  worktreePath: string;
}) => {
  const relativePath = ticketMarkdownPath(input.ticket.shorthand);
  const sourcePath = join(input.repoPath, relativePath);
  const targetPath = join(input.worktreePath, relativePath);

  await mkdir(dirname(targetPath), { recursive: true });
  if (existsSync(sourcePath)) {
    await copyFile(sourcePath, targetPath);
    return;
  }

  await writeFile(targetPath, await ticketToMarkdown(input.storage, input.ticket), "utf8");
};

export const worktreeCreatedHook = defineHook({
  event: worktreeEvents.created,
  async handler(ctx, payload) {
    const ticketRef = ticketRefFromAnchors(payload.anchors);
    if (!ticketRef) return;

    const ticket = await findTicket(ctx.storage, ticketRef);
    if (!ticket) return;

    await copyOrWriteTicketFile({
      repoPath: payload.repoPath,
      storage: ctx.storage,
      ticket,
      worktreePath: payload.worktreePath,
    });
  },
});
