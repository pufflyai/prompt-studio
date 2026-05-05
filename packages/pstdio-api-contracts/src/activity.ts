import { z } from "zod";

export const ACTIVITY_CORE_RESOURCE_TYPES = ["ticket", "workspace", "session"] as const;

export const activityResourceTypeSchema = z.string();
export const activityActorTypeSchema = z.enum(["user", "agent", "system"]);
export const activitySourceSchema = z.enum(["ui", "api", "hook", "system", "agent"]);

export const activityEventSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  resource_type: activityResourceTypeSchema,
  resource_id: z.string(),
  source_extension_id: z.string().nullable(),
  event_type: z.string(),
  actor_type: activityActorTypeSchema,
  actor_id: z.string().nullable(),
  source: activitySourceSchema,
  summary: z.string(),
  payload_json: z.record(z.string(), z.unknown()),
  created_at: z.string(),
});

export const listActivityInputSchema = z.object({
  event_type: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().optional(),
});

export const listProjectActivityInputSchema = listActivityInputSchema.extend({
  resource_type: activityResourceTypeSchema.optional(),
});

export const listActivityResponseSchema = z.object({
  events: z.array(activityEventSchema),
  next_cursor: z.string().nullable(),
});

export type ActivityResourceType = string;
export type ActivityActorType = z.infer<typeof activityActorTypeSchema>;
export type ActivitySource = z.infer<typeof activitySourceSchema>;
export type ActivityEvent = z.infer<typeof activityEventSchema>;
export type ListActivityInput = z.infer<typeof listActivityInputSchema>;
export type ListProjectActivityInput = z.infer<typeof listProjectActivityInputSchema>;
export type ListActivityResponse = z.infer<typeof listActivityResponseSchema>;
