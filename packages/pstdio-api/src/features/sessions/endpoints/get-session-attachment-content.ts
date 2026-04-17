import { readFileSync } from "node:fs";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";

export const getSessionAttachmentContentRoute = createRoute({
  method: "get",
  path: "/sessions/attachments/{attachmentId}/content",
  description: "Download image content for a session attachment.",
  tags: ["Sessions"],
  request: {
    query: z
      .object({
        project_id: z.string().min(1),
      })
      .strict(),
    params: z
      .object({
        attachmentId: z.string(),
      })
      .strict(),
  },
  responses: {
    200: {
      description: "Attachment content.",
      content: {
        "application/octet-stream": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
      },
    },
    404: {
      description: "Attachment not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const getSessionAttachmentContentHandler =
  (deps: RouteDeps): AppRouteHandler<typeof getSessionAttachmentContentRoute> =>
  async (c) => {
    const { attachmentId } = c.req.valid("param");
    const { project_id: projectId } = c.req.valid("query");
    const file = await deps.fileService.get(attachmentId);

    if (!file || file.file_kind !== "session_attachment" || file.project_id !== projectId) {
      return c.json({ error: `Session attachment not found: ${attachmentId}` }, 404);
    }

    let content: Buffer;
    try {
      content = readFileSync(file.storage_path);
    } catch {
      return c.json({ error: `Session attachment not found: ${attachmentId}` }, 404);
    }

    return c.body(new Uint8Array(content), 200, {
      "content-type": file.mime_type ?? "application/octet-stream",
      "cache-control": "private, max-age=60",
    });
  };
