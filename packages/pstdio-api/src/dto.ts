import type { z } from "@hono/zod-openapi";
import type { projectResponseSchema } from "./features/projects/dto";

export type ProjectResponse = z.infer<typeof projectResponseSchema>;
