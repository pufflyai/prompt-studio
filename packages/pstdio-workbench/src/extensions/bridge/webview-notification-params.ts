import { extensionResourceRefSchema, jsonObjectSchema } from "pstdio-api-contracts";
import { isNavigationTarget, type NavigationTarget } from "pstdio-api-contracts/extension-kernel";
import { z } from "zod";

const action = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("navigate"),
    id: z.string(),
    label: z.string(),
    target: z.custom<NavigationTarget>(isNavigationTarget, "Invalid navigation target."),
    primary: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("command"),
    id: z.string(),
    label: z.string(),
    command: z.string(),
    params: jsonObjectSchema.optional(),
    primary: z.boolean().optional(),
    destructive: z.boolean().optional(),
  }),
  z.object({
    kind: z.literal("url"),
    id: z.string(),
    label: z.string(),
    href: z.string(),
    primary: z.boolean().optional(),
  }),
]);

export const webviewNotificationActionParamsSchema = z.object({
  title: z.string().min(1),
  body: z.string().optional(),
  kind: z.enum(["needs_review", "ready_to_merge", "blocked", "approval_required", "failed", "info"]),
  priority: z.enum(["low", "normal", "high", "urgent"]).optional(),
  target: extensionResourceRefSchema.optional(),
  related: z.array(extensionResourceRefSchema).optional(),
  actions: z.array(action).optional(),
  dedupeKey: z.string().optional(),
  expiresAt: z.string().optional(),
  snoozedUntil: z.string().optional(),
  metadata: jsonObjectSchema.optional(),
});
