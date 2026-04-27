import type { RouteDeps } from "../deps";

type EmitDeps = Pick<RouteDeps, "eventBus">;

export const emitSyncedFile = (deps: EmitDeps, file: unknown) => {
  deps.eventBus.emit("files", "set", file);
};

export const emitSyncedTicketFile = (deps: EmitDeps, ticketFile: unknown) => {
  if (!ticketFile) return;
  deps.eventBus.emit("ticket_files", "set", ticketFile);
};

export const emitSyncedWorkspaceArtifact = (deps: EmitDeps, artifact: unknown) => {
  if (!artifact) return;
  deps.eventBus.emit("workspace_artifacts", "set", artifact);
};
