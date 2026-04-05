import { z } from "@hono/zod-openapi";
import {
  createTemplateInputSchema,
  templateSchema,
  templateWithContentSchema,
  updateTemplateInputSchema,
} from "pstdio-api-contracts";

export const templateResponseSchema = templateSchema;
export const templateWithContentResponseSchema = templateWithContentSchema;
export const createTemplateBodySchema = createTemplateInputSchema.strict();
export const updateTemplateBodySchema = updateTemplateInputSchema.strict();

export const notFoundResponseSchema = z.object({ error: z.string() });
export const conflictResponseSchema = z.object({ error: z.string() });
export const badRequestResponseSchema = z.object({ error: z.string() });
