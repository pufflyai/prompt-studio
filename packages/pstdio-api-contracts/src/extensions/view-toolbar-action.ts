import { z } from "zod";
import { extensionParamObjectSchema } from "./commands";
import { jsonObjectSchema, localizableStringSchema } from "./common";

export const viewToolbarActionSchema = z.object({
  id: z.string(),
  label: localizableStringSchema,
  icon: z.string().optional(),
  presentation: z.enum(["primary", "secondary"]).optional(),
  params: jsonObjectSchema.optional(),
  input: extensionParamObjectSchema.optional(),
  submitLabel: z.string().optional(),
  when: z.string().optional(),
  disabled: z.boolean().optional(),
});
export const viewToolbarActionRecordSchema = viewToolbarActionSchema.extend({ commandId: z.string() });
