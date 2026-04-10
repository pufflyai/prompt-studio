import { z } from "@hono/zod-openapi";

export const pluginInfoSchema = z.object({
  identity: z.string(),
  filePath: z.string(),
});

export const pluginsResponseSchema = z.object({
  plugins: z.array(pluginInfoSchema),
  pluginsDir: z.string().nullable(),
});

export const pluginsParamsSchema = z.object({
  projectId: z.string().openapi({ description: "Project ID" }),
});
