import { readFileSync } from "node:fs";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";

const errorResponseSchema = z.object({ error: z.string() });

export const getFileContentRoute = createRoute({
  method: "get",
  path: "/files/{fileId}/content",
  description: "Read generic file content.",
  tags: ["Files"],
  request: {
    params: z.object({ fileId: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "File content.",
      content: { "application/octet-stream": { schema: z.any() } },
    },
    404: {
      description: "File not found.",
      content: { "application/json": { schema: errorResponseSchema } },
    },
  },
});

export const getFileContentHandler = (deps: RouteDeps): AppRouteHandler<typeof getFileContentRoute> => {
  return async (c) => {
    const { fileId } = c.req.valid("param");
    const file = await deps.fileService.get(fileId);
    if (!file) return c.json({ error: `File not found: ${fileId}` }, 404);

    const data = readFileSync(file.storage_path);
    return new Response(data, {
      status: 200,
      headers: {
        "content-type": file.mime_type ?? "application/octet-stream",
        "content-length": String(file.size_bytes),
      },
    });
  };
};
