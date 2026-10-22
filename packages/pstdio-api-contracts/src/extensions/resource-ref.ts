import { z } from "zod";
import { serializableJsonObjectSchema } from "./common";

export const extensionResourceRefSchema = z.object({
  device: z.object({ ownerId: z.string(), id: z.string(), name: z.string() }).optional(),
  shorthand: z.string().optional(),
  type: z.string(),
  id: z.string(),
  projectId: z.string().optional(),
  label: z.string().optional(),
  icon: z.string().optional(),
  extensionId: z.string().optional(),
  metadata: serializableJsonObjectSchema.optional(),
});
