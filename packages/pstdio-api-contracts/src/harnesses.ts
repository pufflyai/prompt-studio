import { z } from "zod";
import { createSessionInputSchema, followUpInputSchema } from "./sessions";

export const harnessAvailabilityTypeSchema = z.enum(["INSTALLED", "NOT_FOUND"]);

export const harnessConfigSchema = z.object({
  id: z.string(),
  harness_id: z.string(),
  is_default: z.boolean(),
  config: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const harnessInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  extension_id: z.string(),
  availability: z.object({ type: harnessAvailabilityTypeSchema }),
});

export const harnessModelSchema = z.object({
  id: z.string(),
});

export const setupHarnessInputSchema = z.object({
  harness_id: z.string().min(1),
  binary: z.string().min(1).optional(),
});

export const setupAvailableHarnessesInputSchema = z.object({
  default_harness_id: z.string().min(1),
});

export const updateHarnessInputSchema = z.object({
  is_default: z.boolean().optional(),
  binary: z.string().optional(),
  skills_dir: z.string().optional(),
});

export const createHarnessSessionInputSchema = createSessionInputSchema
  .omit({ agent: true })
  .extend({ harness: z.string().min(1).optional() });

export const sendHarnessSessionInputSchema = followUpInputSchema
  .omit({ agent: true })
  .extend({ harness: z.string().min(1).optional() });

export type HarnessAvailabilityType = z.infer<typeof harnessAvailabilityTypeSchema>;
export type HarnessConfig = z.infer<typeof harnessConfigSchema>;
export type HarnessInfo = z.infer<typeof harnessInfoSchema>;
export type HarnessModel = z.infer<typeof harnessModelSchema>;
export type SetupHarnessInput = z.infer<typeof setupHarnessInputSchema>;
export type SetupAvailableHarnessesInput = z.infer<typeof setupAvailableHarnessesInputSchema>;
export type UpdateHarnessInput = z.infer<typeof updateHarnessInputSchema>;
export type CreateHarnessSessionInput = z.infer<typeof createHarnessSessionInputSchema>;
export type SendHarnessSessionInput = z.infer<typeof sendHarnessSessionInputSchema>;
