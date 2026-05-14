import { z } from "zod";

export const settingsSchema = z.object({
  max_concurrent_sessions: z.number().int().min(1).nullable(),
});

export const updateSettingsInputSchema = z
  .object({
    max_concurrent_sessions: z.number().int().min(1).nullable().optional(),
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: "Expected at least one setting" });

export type Settings = z.infer<typeof settingsSchema>;
export type UpdateSettingsInput = z.infer<typeof updateSettingsInputSchema>;
