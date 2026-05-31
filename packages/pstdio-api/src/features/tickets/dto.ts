import { z } from "@hono/zod-openapi";
import {
  createTicketAttemptInputSchema,
  createTicketInputSchema,
  fileRecordSchema,
  sessionStatusSchema,
  ticketAttemptModeSchema,
  ticketDetailSchema,
  ticketListItemSchema,
  ticketSchema,
  updateTicketInputSchema,
  uploadTicketFileInputSchema,
} from "pstdio-api-contracts";
import { workspaceResponseSchema } from "../workspaces/dto";

export { ticketAttemptModeSchema };

/** @deprecated Legacy core ticket DTO. Ticket data is owned by the pstdio tickets extension. */
export const ticketResponseSchema = ticketSchema;
/** @deprecated Legacy core ticket DTO. Ticket data is owned by the pstdio tickets extension. */
export const ticketDetailResponseSchema = ticketDetailSchema;
/** @deprecated Legacy core ticket DTO. Ticket data is owned by the pstdio tickets extension. */
export { ticketListItemSchema };
/** @deprecated Legacy core ticket file DTO. Ticket attachments are owned by the pstdio tickets extension. */
export const ticketFileResponseSchema = fileRecordSchema;

/** @deprecated Legacy core ticket DTO. Ticket data is owned by the pstdio tickets extension. */
export const createTicketBodySchema = createTicketInputSchema.strict();
/** @deprecated Legacy core ticket DTO. Ticket data is owned by the pstdio tickets extension. */
export const updateTicketBodySchema = updateTicketInputSchema.strict();
/** @deprecated Legacy core ticket file DTO. Ticket attachments are owned by the pstdio tickets extension. */
export const uploadTicketFileBodySchema = uploadTicketFileInputSchema.strict();
/** @deprecated Legacy core ticket attempt DTO. Ticket attempts are owned by the pstdio tickets extension. */
export const createTicketAttemptBodySchema = createTicketAttemptInputSchema.strict();

export const notFoundResponseSchema = z.object({ error: z.string() });

const ticketAttemptSessionSchema = z.object({
  id: z.string(),
  workspace_id: z.string(),
  title: z.string(),
  status: sessionStatusSchema,
  created_at: z.string(),
  updated_at: z.string(),
});

/** @deprecated Legacy core ticket attempt DTO. Ticket attempts are owned by the pstdio tickets extension. */
export const ticketAttemptResponseSchema = z.object({
  mode: ticketAttemptModeSchema,
  ticket: ticketResponseSchema,
  workspace: workspaceResponseSchema,
  session: ticketAttemptSessionSchema.nullable(),
});
