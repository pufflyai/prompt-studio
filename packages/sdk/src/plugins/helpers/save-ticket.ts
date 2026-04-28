import type { PluginHelperContext } from "./context";
import { findTicketByRef } from "./find-ticket-by-ref";
import { executePlannerCommand } from "./planner";

type SaveTicketInput = {
  rootPath: string;
  ticketId?: string;
  status?: string;
  tags?: string[];
  log?: (message: string) => void;
};

type SaveTicketResult = {
  ticketShorthand: string;
  uploadedFileCount: number;
};

type SaveTicketCommandResult = {
  ticketId?: string;
  ticket_id?: string;
  uploadedFileCount?: number;
  uploaded_file_count?: number;
  messages?: string[];
};

export const saveTicket = async (ctx: PluginHelperContext, input: SaveTicketInput): Promise<SaveTicketResult> => {
  const ticket = await findTicketByRef(ctx, { ticketId: input.ticketId });
  if (!ticket) throw new Error(`Ticket not found: ${input.ticketId ?? "<none>"}`);

  const result = (await executePlannerCommand(ctx, "pstdio.planner.saveTicket", {
    ticket_id: ticket.shorthand,
    repo_path: input.rootPath,
    status: input.status,
    tags: input.tags,
  })) as SaveTicketCommandResult;

  const log = input.log ?? (() => {});
  for (const message of result.messages ?? [`Saved ticket ${ticket.shorthand}`]) log(message);

  return {
    ticketShorthand: result.ticket_id ?? result.ticketId ?? ticket.shorthand,
    uploadedFileCount: result.uploaded_file_count ?? result.uploadedFileCount ?? 0,
  };
};

export type { SaveTicketInput, SaveTicketResult };
