import { z } from "@hono/zod-openapi";
import {
  createNotificationInputSchema,
  listNotificationsResponseSchema,
  notificationCountResponseSchema,
  notificationPrioritySchema,
  notificationSchema,
  notificationStatusSchema,
  resolveByDedupeKeyInputSchema,
  snoozeInputSchema,
  updateNotificationInputSchema,
} from "pstdio-api-contracts";

export const notificationResponseSchema = notificationSchema;
export const listNotificationsResponseDtoSchema = listNotificationsResponseSchema;
export const notificationCountResponseDtoSchema = notificationCountResponseSchema;

export const createNotificationBodySchema = createNotificationInputSchema.omit({ projectId: true }).strict();
export const updateNotificationBodySchema = updateNotificationInputSchema.strict();
export const snoozeBodySchema = snoozeInputSchema.strict();
export const resolveByDedupeKeyBodySchema = resolveByDedupeKeyInputSchema.strict();

export const listNotificationsQueryParamsSchema = z
  .object({
    status: z.string().optional(),
    priority: z.string().optional(),
    sourceExtensionId: z.string().optional(),
    resourceType: z.string().optional(),
    resourceId: z.string().optional(),
    cursor: z.string().optional(),
    limit: z.coerce.number().int().optional(),
  })
  .strict();

export const countNotificationsQueryParamsSchema = z
  .object({
    status: z.string().optional(),
    priority: z.string().optional(),
    sourceExtensionId: z.string().optional(),
  })
  .strict();

export const notFoundResponseSchema = z.object({ error: z.string() });
export const invalidFilterResponseSchema = z.object({ error: z.string() });

export class NotificationFilterError extends Error {}

const splitCsv = (value: string | undefined) => value?.split(",").map((s) => s.trim());

export const parseStatusFilter = (value: string | undefined) => {
  const parts = splitCsv(value);
  if (!parts) return undefined;
  const invalid = parts.find((s) => !s || !notificationStatusSchema.safeParse(s).success);
  if (invalid !== undefined) throw new NotificationFilterError(`Invalid notification status: ${invalid || "<empty>"}`);
  return parts;
};

export const parsePriorityFilter = (value: string | undefined) => {
  const parts = splitCsv(value);
  if (!parts) return undefined;
  const invalid = parts.find((s) => !s || !notificationPrioritySchema.safeParse(s).success);
  if (invalid !== undefined)
    throw new NotificationFilterError(`Invalid notification priority: ${invalid || "<empty>"}`);
  return parts;
};
