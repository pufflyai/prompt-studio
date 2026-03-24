import type { RouteDeps } from "../deps";

export const emitSyncedFile = (deps: RouteDeps, file: unknown) => {
  deps.eventBus.emit("files", "set", file);
};

export const emitSyncedTicketFile = (deps: RouteDeps, ticketFile: unknown) => {
  if (!ticketFile) return;
  deps.eventBus.emit("ticket_files", "set", ticketFile);
};
