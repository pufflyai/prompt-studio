import { createRoute, z } from "@hono/zod-openapi";

const errorSchema = z.object({ error: z.string() });
const extensionFileScopeQuerySchema = z
  .object({
    scope_type: z.string().optional(),
    scope_id: z.string().optional(),
  })
  .strict();

const extensionFileParamsSchema = z
  .object({
    projectId: z.string(),
    extensionInstanceId: z.string(),
  })
  .strict();

const extensionCommandFileParamsSchema = z
  .object({
    projectId: z.string(),
    commandId: z.string(),
  })
  .strict();

const extensionFileContentParamsSchema = extensionFileParamsSchema
  .extend({
    fileId: z.string(),
  })
  .strict();

const extensionBlobRefSchema = z.object({
  id: z.string(),
  name: z.string(),
  mimeType: z.string().nullable(),
  size: z.number(),
  hash: z.string().nullable(),
  url: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const uploadExtensionCommandFileRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/commands/{commandId}/files",
  description: "Upload a file owned by the enabled extension that registered a command.",
  tags: ["Extensions"],
  request: {
    params: extensionCommandFileParamsSchema,
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
      description: "Extension command file uploaded.",
      content: { "application/json": { schema: extensionBlobRefSchema } },
    },
    404: {
      description: "Project or enabled command not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const uploadExtensionFileRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{extensionInstanceId}/files",
  description: "Upload a file owned by an extension instance.",
  tags: ["Extensions"],
  request: {
    query: extensionFileScopeQuerySchema,
    params: extensionFileParamsSchema,
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
      description: "Extension file uploaded.",
      content: { "application/json": { schema: extensionBlobRefSchema } },
    },
    404: {
      description: "Extension instance not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const listExtensionFilesRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{extensionInstanceId}/files",
  description: "List files owned by an extension instance scope.",
  tags: ["Extensions"],
  request: {
    query: extensionFileScopeQuerySchema,
    params: extensionFileParamsSchema,
  },
  responses: {
    200: {
      description: "Extension files.",
      content: {
        "application/json": {
          schema: z.object({ files: z.array(extensionBlobRefSchema) }),
        },
      },
    },
    404: {
      description: "Extension instance not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const getExtensionFileContentRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{extensionInstanceId}/files/{fileId}/content",
  description: "Download an extension-owned file.",
  tags: ["Extensions"],
  request: {
    params: extensionFileContentParamsSchema,
  },
  responses: {
    200: {
      description: "Extension file content.",
      content: {
        "application/octet-stream": {
          schema: z.string().openapi({ type: "string", format: "binary" }),
        },
      },
    },
    404: {
      description: "File not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const deleteExtensionFileRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/extensions/{extensionInstanceId}/files/{fileId}",
  description: "Delete an extension file ownership row and its bytes.",
  tags: ["Extensions"],
  request: {
    params: extensionFileContentParamsSchema,
  },
  responses: {
    204: { description: "Extension file deleted." },
    404: {
      description: "File not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});
