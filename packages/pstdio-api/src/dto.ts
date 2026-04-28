import type { z } from "@hono/zod-openapi";
import type {
  statusSchema,
  tagOptionSchema,
  tagSchema,
  ticketDetailSchema,
  ticketListItemSchema,
  ticketSchema,
} from "pstdio-api-contracts";
import type { projectResponseSchema } from "./features/projects/dto";
import type { templateResponseSchema } from "./features/templates/dto";

export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type StatusResponse = z.infer<typeof statusSchema>;
export type TagOptionResponse = z.infer<typeof tagOptionSchema>;
export type TagResponse = z.infer<typeof tagSchema>;
export type TemplateResponse = z.infer<typeof templateResponseSchema>;
export type TicketDetailResponse = z.infer<typeof ticketDetailSchema>;
export type TicketListItem = z.infer<typeof ticketListItemSchema>;
export type TicketResponse = z.infer<typeof ticketSchema>;
