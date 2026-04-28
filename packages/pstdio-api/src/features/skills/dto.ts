import { z } from "@hono/zod-openapi";
import {
  copySkillInputSchema,
  skillSchema,
  skillWithContentSchema,
  updateSkillInputSchema,
} from "pstdio-api-contracts";

export const skillResponseSchema = skillSchema;
export const skillWithContentResponseSchema = skillWithContentSchema;
export const copySkillBodySchema = copySkillInputSchema.strict();
export const updateSkillBodySchema = updateSkillInputSchema.strict();
export const notFoundResponseSchema = z.object({ error: z.string() });
export const badRequestResponseSchema = z.object({ error: z.string() });
export const conflictResponseSchema = z.object({ error: z.string() });
