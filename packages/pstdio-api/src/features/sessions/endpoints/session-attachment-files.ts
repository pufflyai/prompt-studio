import { readFile } from "node:fs/promises";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { SessionsRouteDeps } from "../deps";
import {
  getProjectSessionAttachment,
  isSessionAttachmentSubmitted,
  SESSION_ATTACHMENT_FILE_KIND,
  sessionAttachmentContentUrl,
  toSessionAttachment,
} from "../session-attachments";

const MAX_SESSION_ATTACHMENT_UPLOAD_BYTES = 25 * 1024 * 1024;

const errorSchema = z.object({ error: z.string() });

const sessionAttachmentParamsSchema = z
  .object({
    projectId: z.string(),
  })
  .strict();

const sessionAttachmentContentParamsSchema = sessionAttachmentParamsSchema
  .extend({
    fileId: z.string(),
  })
  .strict();

const sessionAttachmentSchema = z.object({
  file_id: z.string(),
  name: z.string(),
  mime_type: z.string().nullable(),
  size_bytes: z.number(),
  hash: z.string().nullable(),
  url: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const uploadSessionAttachmentRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/session-attachments",
  description: "Upload a project-scoped session attachment.",
  tags: ["Sessions"],
  request: {
    params: sessionAttachmentParamsSchema,
    body: {
      content: {
        "application/octet-stream": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Session attachment uploaded.",
      content: { "application/json": { schema: sessionAttachmentSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    413: {
      description: "Upload too large.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const getSessionAttachmentContentRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/session-attachments/{fileId}/content",
  description: "Download a project-scoped session attachment.",
  tags: ["Sessions"],
  request: {
    params: sessionAttachmentContentParamsSchema,
  },
  responses: {
    200: {
      description: "Session attachment content.",
      content: {
        "application/octet-stream": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
      },
    },
    404: {
      description: "Attachment not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const deleteSessionAttachmentRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/session-attachments/{fileId}",
  description: "Delete an unsubmitted project-scoped session attachment.",
  tags: ["Sessions"],
  request: {
    params: sessionAttachmentContentParamsSchema,
  },
  responses: {
    204: {
      description: "Session attachment deleted.",
    },
    404: {
      description: "Attachment not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Attachment already submitted.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

const readUploadName = (headers: Headers) => {
  const name = headers.get("x-file-name")?.trim();
  if (!name) return "attachment";

  try {
    return decodeURIComponent(name);
  } catch {
    return name;
  }
};

const isMissingFileError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export const uploadSessionAttachmentHandler = (
  deps: SessionsRouteDeps,
): AppRouteHandler<typeof uploadSessionAttachmentRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const project = await deps.projectService.get(projectId);
    if (!project) return c.json({ error: `Project not found: ${projectId}` }, 404);

    const data = Buffer.from(await c.req.arrayBuffer());
    if (data.byteLength > MAX_SESSION_ATTACHMENT_UPLOAD_BYTES) {
      return c.json({ error: "Session attachment upload exceeds the maximum size." }, 413);
    }

    const file = await deps.fileService.upload({
      project_id: projectId,
      file_name: readUploadName(c.req.raw.headers),
      file_kind: SESSION_ATTACHMENT_FILE_KIND,
      data,
      mime_type: c.req.raw.headers.get("content-type"),
    });
    deps.eventBus.emit("files", "set", file);

    return c.json(toSessionAttachment(projectId, file), 201);
  };
};

export const getSessionAttachmentContentHandler = (
  deps: SessionsRouteDeps,
): AppRouteHandler<typeof getSessionAttachmentContentRoute> => {
  return async (c) => {
    const { fileId, projectId } = c.req.valid("param");
    const file = await getProjectSessionAttachment(deps, projectId, fileId);
    if (!file) return c.json({ error: `Session attachment not found: ${fileId}` }, 404);

    try {
      return c.body(await readFile(file.storage_path), 200, {
        "content-type": file.mime_type ?? "application/octet-stream",
        ...(file.hash ? { etag: file.hash } : {}),
      });
    } catch (error) {
      if (isMissingFileError(error)) return c.json({ error: `Session attachment not found: ${fileId}` }, 404);
      throw error;
    }
  };
};

export const deleteSessionAttachmentHandler = (
  deps: SessionsRouteDeps,
): AppRouteHandler<typeof deleteSessionAttachmentRoute> => {
  return async (c) => {
    const { fileId, projectId } = c.req.valid("param");
    const file = await getProjectSessionAttachment(deps, projectId, fileId);
    if (!file) return c.json({ error: `Session attachment not found: ${fileId}` }, 404);

    if (await isSessionAttachmentSubmitted(deps, projectId, fileId)) {
      return c.json({ error: "Session attachment is already submitted." }, 409);
    }

    await deps.fileService.remove(fileId);
    deps.eventBus.emit("files", "delete", { id: fileId });

    return c.body(null, 204);
  };
};

export { sessionAttachmentContentUrl };
