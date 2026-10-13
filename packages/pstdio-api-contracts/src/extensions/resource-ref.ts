import { z } from "zod";
import { serializableJsonObjectSchema } from "./common";

export const resourceContextSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("workspace"),
      id: z.string(),
      projectId: z.string().optional(),
      label: z.string().optional(),
    })
    .strict(),
  z.object({ type: z.literal("project"), id: z.string(), label: z.string().optional() }).strict(),
]);

export const extensionResourceRefSchema = z.object({
  shorthand: z.string().optional(),
  type: z.string(),
  id: z.string(),
  projectId: z.string().optional(),
  label: z.string().optional(),
  icon: z.string().optional(),
  extensionId: z.string().optional(),
  metadata: serializableJsonObjectSchema.optional(),
  context: resourceContextSchema.optional(),
});
