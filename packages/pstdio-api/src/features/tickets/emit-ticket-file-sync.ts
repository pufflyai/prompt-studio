import type { TicketsRouteDeps } from "./deps";

export const emitSyncedFile = (deps: TicketsRouteDeps, file: unknown) => {
  deps.eventBus.emit("files", "set", file);
};

export const emitSyncedTicketFile = (deps: TicketsRouteDeps, ticketFile: unknown) => {
  if (!ticketFile) return;
  deps.eventBus.emit("ticket_files", "set", ticketFile);
};

export const emitSyncedWorkspaceArtifact = (deps: TicketsRouteDeps, artifact: unknown) => {
  if (!artifact) return;
  deps.eventBus.emit("workspace_artifacts", "set", artifact);
};
