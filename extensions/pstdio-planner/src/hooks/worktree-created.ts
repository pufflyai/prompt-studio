import {
  type ArtifactMount,
  defineHook,
  type ExtensionStorageApi,
  type WorkspaceFilesMount,
  type WorkspaceProvisionPayload,
  workspaceEvents,
} from "@pstdio/sdk/extensions";
import { ensureTicketDraftsIgnored, ticketMarkdownPath, ticketToMarkdown } from "../data/draft-storage";
import { findTicket } from "../data/resolve";
import type { StoredTicket } from "../data/types";
import { ticketRefFromAnchors } from "../data/workspace-ticket-link";

export const copyOrWriteTicketFile = async (input: {
  projectFiles: ArtifactMount;
  storage: ExtensionStorageApi;
  ticket: StoredTicket;
  workspaceFiles: WorkspaceFilesMount;
}) => {
  const relativePath = ticketMarkdownPath(input.ticket.shorthand);
  const content = (await input.projectFiles.exists(relativePath))
    ? await input.projectFiles.readText(relativePath)
    : await ticketToMarkdown(input.storage, input.ticket);
  await ensureTicketDraftsIgnored(input.workspaceFiles);
  await input.workspaceFiles.writeText(relativePath, content);
};

export const worktreeCreatedHook = defineHook<WorkspaceProvisionPayload>({
  id: "worktree-created",
  event: workspaceEvents.provision,
  async run(ctx, payload) {
    const ticketRef = ticketRefFromAnchors(payload.workspace.anchors_json);
    if (!ticketRef) return;

    const ticket = await findTicket(ctx.storage, ticketRef);
    if (!ticket) return;
    if (!ctx.projectFiles || !ctx.workspaceFiles) throw new Error("Workspace file mounts are unavailable.");

    await copyOrWriteTicketFile({
      projectFiles: ctx.projectFiles,
      storage: ctx.storage,
      ticket,
      workspaceFiles: ctx.workspaceFiles,
    });
  },
});
