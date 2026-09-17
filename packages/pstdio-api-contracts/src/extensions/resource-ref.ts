import { z } from "zod";
import { serializableJsonObjectSchema } from "./common";

export const extensionResourceRefSchema = z.object({
  shorthand: z.string().optional(),
  type: z.string(),
  id: z.string(),
  projectId: z.string().optional(),
  label: z.string().optional(),
  icon: z.string().optional(),
  extensionId: z.string().optional(),
  metadata: serializableJsonObjectSchema.optional(),
});
