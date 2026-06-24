import { z } from "zod";

export const NOTIFICATION_KINDS = [
  "needs_review",
  "ready_to_merge",
  "blocked",
  "approval_required",
  "failed",
  "info",
] as const;

export const NOTIFICATION_STATUSES = ["open", "read", "snoozed", "done", "dismissed", "expired"] as const;

export const NOTIFICATION_PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export const NOTIFICATION_LIVE_STATUSES = ["open", "read", "snoozed"] as const;
export const NOTIFICATION_TERMINAL_STATUSES = ["done", "dismissed", "expired"] as const;

export const notificationKindSchema = z.enum(NOTIFICATION_KINDS);
export const notificationStatusSchema = z.enum(NOTIFICATION_STATUSES);
export const notificationPrioritySchema = z.enum(NOTIFICATION_PRIORITIES);

export const notificationOriginSchema = z.enum(["core", "extension", "agent"]);
export const notificationActorTypeSchema = z.enum(["user", "agent", "system"]);

export const resourceRefSchema = z.object({
  type: z.string(),
  id: z.string(),
  projectId: z.string().optional(),
  label: z.string().optional(),
  extensionId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const baseAction = z.object({
  id: z.string(),
  label: z.string(),
  primary: z.boolean().optional(),
});

export const notificationActionSchema = z.discriminatedUnion("kind", [
  baseAction.extend({ kind: z.literal("open-resource"), resource: resourceRefSchema }),
  baseAction.extend({
    kind: z.literal("command"),
    command: z.string(),
    params: z.record(z.string(), z.unknown()).optional(),
    destructive: z.boolean().optional(),
  }),
  baseAction.extend({ kind: z.literal("url"), href: z.string() }),
]);

export const notificationSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  body: z.string().nullable().optional(),
  kind: notificationKindSchema,
  status: notificationStatusSchema,
  priority: notificationPrioritySchema,
  source: z.string(),
  origin: notificationOriginSchema,
  sourceExtensionId: z.string().nullable().optional(),
  actorType: notificationActorTypeSchema.nullable().optional(),
  actorId: z.string().nullable().optional(),
  target: resourceRefSchema.nullable().optional(),
  related: z.array(resourceRefSchema),
  actions: z.array(notificationActionSchema),
  dedupeKey: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  readAt: z.string().nullable().optional(),
  resolvedAt: z.string().nullable().optional(),
  snoozedUntil: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
});

export const createNotificationInputSchema = z.object({
  projectId: z.string(),
  title: z.string(),
  body: z.string().optional(),
  kind: notificationKindSchema,
  priority: notificationPrioritySchema.optional(),
  target: resourceRefSchema.optional(),
  related: z.array(resourceRefSchema).optional(),
  actions: z.array(notificationActionSchema).optional(),
  dedupeKey: z.string().optional(),
  expiresAt: z.string().optional(),
  snoozedUntil: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const updateNotificationInputSchema = z.object({
  status: z.enum(["read", "snoozed", "done", "dismissed"]).optional(),
  priority: notificationPrioritySchema.optional(),
  snoozedUntil: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const snoozeInputSchema = z.object({ until: z.string() });

export const resolveByDedupeKeyInputSchema = z.object({
  dedupeKey: z.string(),
  status: z.enum(["done", "dismissed", "expired"]).optional(),
});

export const listNotificationsQuerySchema = z.object({
  status: z.union([notificationStatusSchema, z.array(notificationStatusSchema)]).optional(),
  priority: z.union([notificationPrioritySchema, z.array(notificationPrioritySchema)]).optional(),
  sourceExtensionId: z.string().optional(),
  resourceType: z.string().optional(),
  resourceId: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().optional(),
});

export const listNotificationsResponseSchema = z.object({
  items: z.array(notificationSchema),
  nextCursor: z.string().nullable(),
});

export const notificationCountResponseSchema = z.object({ count: z.number().int() });

export const notificationActionResultSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("open-resource"), resource: resourceRefSchema }),
  z.object({ kind: z.literal("command"), commandId: z.string(), outcome: z.record(z.string(), z.unknown()) }),
  z.object({ kind: z.literal("url"), href: z.string() }),
]);

export type NotificationKind = z.infer<typeof notificationKindSchema>;
export type NotificationStatus = z.infer<typeof notificationStatusSchema>;
export type NotificationPriority = z.infer<typeof notificationPrioritySchema>;
export type NotificationOrigin = z.infer<typeof notificationOriginSchema>;
export type NotificationActorType = z.infer<typeof notificationActorTypeSchema>;
export type NotificationAction = z.infer<typeof notificationActionSchema>;
export type Notification = z.infer<typeof notificationSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;
export type UpdateNotificationInput = z.infer<typeof updateNotificationInputSchema>;
export type SnoozeNotificationInput = z.infer<typeof snoozeInputSchema>;
export type ResolveByDedupeKeyInput = z.infer<typeof resolveByDedupeKeyInputSchema>;
export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;
export type ListNotificationsResponse = z.infer<typeof listNotificationsResponseSchema>;
export type NotificationCountResponse = z.infer<typeof notificationCountResponseSchema>;
export type NotificationActionResult = z.infer<typeof notificationActionResultSchema>;
