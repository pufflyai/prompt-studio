import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import { notFoundResponseSchema } from "../dto";
import {
  assertImageDataMatchesMimeType,
  assertValidUploadMetadata,
  decodeAttachmentBase64,
} from "../session-attachments";

const uploadSessionAttachmentBodySchema = z
  .object({
    project_id: z.string().min(1),
    file_name: z.string().min(1),
    mime_type: z.string().min(1),
    content_base64: z.string().min(1),
  })
  .strict();

const sessionAttachmentResponseSchema = z.object({
  id: z.string(),
  file_name: z.string(),
  mime_type: z.string(),
  size_bytes: z.number().int().positive(),
});

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
      content: { "application/json": { schema: sessionAttachmentResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: notFoundResponseSchema } },
    },
    400: {
      description: "Invalid image upload.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});

export const uploadSessionAttachmentHandler =
  (deps: RouteDeps): AppRouteHandler<typeof uploadSessionAttachmentRoute> =>
  async (c) => {
    const input = c.req.valid("json");
    const project = await deps.projectService.get(input.project_id);

    if (!project) {
      return c.json({ error: `Project not found: ${input.project_id}` }, 404);
    }

    let data: Buffer;
    try {
      data = decodeAttachmentBase64(input.content_base64);
    } catch {
      return c.json({ error: "Invalid base64 image payload." }, 400);
    }

    let mimeType: string;
    try {
      mimeType = assertValidUploadMetadata(input.mime_type, data.byteLength);
      assertImageDataMatchesMimeType(mimeType, data);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Invalid image upload." }, 400);
    }

    const file = await deps.fileService.upload({
      project_id: input.project_id,
      file_name: input.file_name,
      file_kind: "session_attachment",
      data,
      mime_type: mimeType,
    });

    return c.json(
      {
        id: file.id,
        file_name: file.file_name,
        mime_type: mimeType,
        size_bytes: file.size_bytes,
      },
      201,
    );
  };
