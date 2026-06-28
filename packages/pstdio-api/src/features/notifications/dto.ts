import { z } from "@hono/zod-openapi";

export const notificationKindSchema = z.enum([
  "needs_review",
  "ready_to_merge",
  "blocked",
  "approval_required",
  "failed",
  "info",
]);

export const notificationStatusSchema = z.enum(["open", "read", "snoozed", "done", "dismissed", "expired"]);
export const notificationPrioritySchema = z.enum(["low", "normal", "high", "urgent"]);

export const resourceRefSchema = z
  .object({
    type: z.string(),
    id: z.string(),
    projectId: z.string().optional(),
    label: z.string().optional(),
    extensionId: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .passthrough();

export const notificationActionSchema = z.discriminatedUnion("kind", [
  z
    .object({
      id: z.string(),
      label: z.string(),
      kind: z.literal("open-resource"),
      resource: resourceRefSchema,
      primary: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      label: z.string(),
      kind: z.literal("command"),
      command: z.string(),
      params: z.record(z.string(), z.any()).optional(),
      primary: z.boolean().optional(),
      destructive: z.boolean().optional(),
    })
    .strict(),
  z
    .object({
      id: z.string(),
      label: z.string(),
      kind: z.literal("url"),
      href: z.string(),
      primary: z.boolean().optional(),
    })
    .strict(),
]);

export const notificationResponseSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    title: z.string(),
    body: z.string().nullable().optional(),
    kind: notificationKindSchema,
    status: notificationStatusSchema,
    priority: notificationPrioritySchema,
    source: z.string(),
    origin: z.enum(["core", "extension", "agent"]),
    sourceExtensionId: z.string().nullable().optional(),
    actorType: z.enum(["user", "agent", "system"]).nullable().optional(),
    actorId: z.string().nullable().optional(),
    target: resourceRefSchema.nullable().optional(),
    related: z.array(resourceRefSchema),
    actions: z.array(notificationActionSchema),
    dedupeKey: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.any()).nullable().optional(),
    createdAt: z.string(),
    updatedAt: z.string(),
    readAt: z.string().nullable().optional(),
    resolvedAt: z.string().nullable().optional(),
    snoozedUntil: z.string().nullable().optional(),
    expiresAt: z.string().nullable().optional(),
  })
  .strict();

export const createNotificationBodySchema = z
  .object({
    title: z.string().min(1),
    body: z.string().optional(),
    kind: notificationKindSchema,
    priority: notificationPrioritySchema.optional(),
    target: resourceRefSchema.optional(),
    related: z.array(resourceRefSchema).optional(),
    actions: z.array(notificationActionSchema).optional(),
    dedupeKey: z.string().optional(),
    expiresAt: z.string().optional(),
    snoozedUntil: z.string().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export const updateNotificationBodySchema = z
  .object({
    priority: notificationPrioritySchema.optional(),
    snoozedUntil: z.string().nullable().optional(),
    metadata: z.record(z.string(), z.any()).optional(),
  })
  .strict();

export const listNotificationsQuerySchema = z
  .object({
    status: z.string().optional(),
    priority: z.string().optional(),
    sourceExtensionId: z.string().optional(),
    resourceType: z.string().optional(),
    resourceId: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().optional(),
  })
  .strict();

export const countNotificationsQuerySchema = listNotificationsQuerySchema
  .pick({ status: true, priority: true, sourceExtensionId: true })
  .strict();

export const notificationParamsSchema = z.object({ projectId: z.string(), id: z.string() }).strict();
export const projectParamsSchema = z.object({ projectId: z.string() }).strict();

export const listNotificationsResponseSchema = z
  .object({
    items: z.array(notificationResponseSchema),
    nextCursor: z.string().nullable().optional(),
  })
  .strict();

export const countNotificationsResponseSchema = z.object({ count: z.number() }).strict();

export const snoozeNotificationBodySchema = z.object({ until: z.string() }).strict();
export const resolveByDedupeKeyBodySchema = z
  .object({
    dedupeKey: z.string().min(1),
    status: z.enum(["done", "dismissed", "expired"]).optional(),
  })
  .strict();

export const resolveByDedupeKeyResponseSchema = z
  .object({
    resolved: z.number(),
    notifications: z.array(notificationResponseSchema),
  })
  .strict();

export const errorResponseSchema = z.object({ error: z.string() }).strict();
