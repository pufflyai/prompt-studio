import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import {
  notFoundResponseSchema,
  sessionPromptAttachmentResponseSchema,
  uploadSessionAttachmentBodySchema,
} from "../dto";

const SUPPORTED_IMAGE_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export const uploadSessionAttachmentRoute = createRoute({
  method: "post",
  path: "/sessions/attachments",
  description: "Upload an image attachment for a session prompt.",
  tags: ["Sessions"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: uploadSessionAttachmentBodySchema } },
    },
  },
  responses: {
    201: {
      description: "Attachment uploaded.",
      content: { "application/json": { schema: sessionPromptAttachmentResponseSchema } },
    },
    400: {
      description: "Unsupported attachment MIME type.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
  },
});

export const uploadSessionAttachmentHandler = (
  deps: RouteDeps,
): AppRouteHandler<typeof uploadSessionAttachmentRoute> => {
  return async (c) => {
    const input = c.req.valid("json");

    const project = await deps.projectService.get(input.project_id);
    if (!project) {
      return c.json({ error: `Project not found: ${input.project_id}` }, 404);
    }

    if (!SUPPORTED_IMAGE_MIME_TYPES.has(input.mime_type)) {
      return c.json({ error: `Unsupported attachment MIME type: ${input.mime_type}` }, 400);
    }

    const uploaded = await deps.fileService.upload({
      project_id: input.project_id,
      file_name: input.file_name,
      file_kind: "session_attachment",
      data: Buffer.from(input.content_base64, "base64"),
      mime_type: input.mime_type,
    });

    return c.json(
      {
        id: uploaded.id,
        file_name: uploaded.file_name,
        mime_type: uploaded.mime_type ?? input.mime_type,
        size_bytes: uploaded.size_bytes,
      },
      201,
    );
  };
};
