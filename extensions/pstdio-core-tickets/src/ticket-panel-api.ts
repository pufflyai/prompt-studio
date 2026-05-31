import type { GuestHost } from "@pstdio/sdk/extensions";
import type { CommandResponse, TicketBoardReadModel, TicketDocumentReadModel } from "./ticket-panel-types";

export const commandIds = {
  archive: "pstdio-core-tickets.tickets.archive",
  create: "pstdio-core-tickets.tickets.create",
  readBoard: "pstdio-core-tickets.ticketBoard.read",
  readDocument: "pstdio-core-tickets.ticketDocument.read",
  update: "pstdio-core-tickets.tickets.update",
  updateDocument: "pstdio-core-tickets.ticketDocument.update",
};

export const executeTicketCommand = async (host: GuestHost, commandId: string, params?: Record<string, unknown>) => {
  const response = await host.call<CommandResponse>("commands.execute", { commandId, params });
  if (response.outcome.status !== "success") {
    throw new Error(response.outcome.reason ?? "Ticket command failed.");
  }
  return response.outcome.value;
};

export const readTicketBoard = async (host: GuestHost) =>
  (await executeTicketCommand(host, commandIds.readBoard)) as TicketBoardReadModel;

export const readTicketDocument = async (host: GuestHost, ticket: string) =>
  (await executeTicketCommand(host, commandIds.readDocument, { ticket })) as TicketDocumentReadModel;

export const updateTicketDocumentFile = async (
  host: GuestHost,
  input: { ticket: string; fileId: string; content: string },
) => {
  await executeTicketCommand(host, commandIds.updateDocument, input);
};

export const createTicket = async (host: GuestHost, input: { content: string; status?: string }) => {
  await executeTicketCommand(host, commandIds.create, input);
};

export const updateTicketStatus = async (host: GuestHost, input: { id: string; status: string }) => {
  await executeTicketCommand(host, commandIds.update, input);
};

export const archiveTicket = async (host: GuestHost, id: string) => {
  await executeTicketCommand(host, commandIds.archive, { id });
};

export const notifyInfo = async (host: GuestHost, title: string, message?: string) => {
  await host.call("notification.show", { level: "info", title, message });
};
