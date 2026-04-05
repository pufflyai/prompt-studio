import { z } from "@hono/zod-openapi";
import { skillSchema, skillWithContentSchema } from "pstdio-api-contracts";

export const skillResponseSchema = skillSchema;
export const skillWithContentResponseSchema = skillWithContentSchema;
export const notFoundResponseSchema = z.object({ error: z.string() });
