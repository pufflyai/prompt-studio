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

export const ticketResponseSchema = ticketSchema;
export const ticketDetailResponseSchema = ticketDetailSchema;
export { ticketListItemSchema };
export const ticketFileResponseSchema = fileRecordSchema;

export const createTicketBodySchema = createTicketInputSchema.strict();
export const updateTicketBodySchema = updateTicketInputSchema.strict();
export const uploadTicketFileBodySchema = uploadTicketFileInputSchema.strict();
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

export const ticketAttemptResponseSchema = z.object({
  mode: ticketAttemptModeSchema,
  ticket: ticketResponseSchema,
  workspace: workspaceResponseSchema,
  session: ticketAttemptSessionSchema.nullable(),
});
