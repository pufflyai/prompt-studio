import { z } from "zod";
import { extensionResourceRefSchema } from "./extensions/resource-ref";

export const resourceLinkRefSchema = extensionResourceRefSchema.extend({
  type: z.string().min(1),
  id: z.string().min(1),
  projectId: z.string().min(1).optional(),
  extensionId: z.string().min(1).optional(),
});
export const resourceAnchorSchema = resourceLinkRefSchema.extend({
  role: z.enum(["primary", "context", "source", "result"]).optional(),
});
export const addResourceAnchorsSchema = z.object({
  resource: resourceLinkRefSchema,
  anchors: z.array(resourceAnchorSchema).max(100),
});
export const removeResourceAnchorsSchema = z.object({
  resource: resourceLinkRefSchema,
  refs: z.array(resourceLinkRefSchema).max(100),
});
export const resourceAnchorQuerySchema = z.object({
  resource: resourceLinkRefSchema,
  direction: z.enum(["outgoing", "incoming", "both"]).optional(),
  role: z.enum(["primary", "context", "source", "result"]).optional(),
  cursor: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});
export const resourceAnchorPageSchema = z.object({
  items: z.array(z.object({ source: resourceLinkRefSchema, target: resourceAnchorSchema })),
  nextCursor: z.string().optional(),
});
