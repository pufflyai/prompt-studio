import { z } from "@hono/zod-openapi";
import { createProjectInputSchema, projectSchema } from "pstdio-api-contracts";

export const projectResponseSchema = projectSchema;
export const createProjectBodySchema = createProjectInputSchema.strict();
export const notFoundResponseSchema = z.object({ error: z.string() });
