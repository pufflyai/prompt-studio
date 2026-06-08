import type { z } from "@hono/zod-openapi";
import type { projectResponseSchema } from "./features/projects/dto";
import type { templateResponseSchema } from "./features/templates/dto";

export type ProjectResponse = z.infer<typeof projectResponseSchema>;
export type TemplateResponse = z.infer<typeof templateResponseSchema>;
