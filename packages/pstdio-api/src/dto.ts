import type { z } from "@hono/zod-openapi";
import type { projectResponseSchema } from "./features/projects/dto";
import type { statusResponseSchema } from "./features/statuses/dto";
import type { tagResponseSchema } from "./features/tags/dto";
import type { templateResponseSchema } from "./features/templates/dto";
import type { ticketDetailResponseSchema, ticketListItemSchema, ticketResponseSchema } from "./features/tickets/dto";

export type TicketResponse = z.infer<typeof ticketResponseSchema>;
export type TicketDetailResponse = z.infer<typeof ticketDetailResponseSchema>;
export type TicketListItem = z.infer<typeof ticketListItemSchema>;
export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type StatusResponse = z.infer<typeof statusResponseSchema>;
export type TagResponse = z.infer<typeof tagResponseSchema>;
export type TemplateResponse = z.infer<typeof templateResponseSchema>;
