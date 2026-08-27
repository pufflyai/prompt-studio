import {
  defineHook,
  type ArtifactMount,
  type ExtensionStorageApi,
  type WorkspaceProvisionPayload,
  type WorkspaceFilesMount,
  workspaceEvents,
} from "@pstdio/sdk/extensions";
import { ticketMarkdownPath, ticketToMarkdown } from "../data/draft-storage";
import { findTicket } from "../data/resolve";
import type { StoredTicket } from "../data/types";
import { ticketRefFromAnchors } from "../data/workspace-ticket-link";

const copyOrWriteTicketFile = async (input: {
  repoFiles: ArtifactMount;
  storage: ExtensionStorageApi;
  ticket: StoredTicket;
  workspaceFiles: WorkspaceFilesMount;
}) => {
  const relativePath = ticketMarkdownPath(input.ticket.shorthand);
  const content = (await input.repoFiles.exists(relativePath))
    ? await input.repoFiles.readText(relativePath)
    : await ticketToMarkdown(input.storage, input.ticket);
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
    if (!ctx.repoFiles || !ctx.workspaceFiles) throw new Error("Workspace file mounts are unavailable.");

    await copyOrWriteTicketFile({
      repoFiles: ctx.repoFiles,
      storage: ctx.storage,
      ticket,
      workspaceFiles: ctx.workspaceFiles,
    });
  },
});
