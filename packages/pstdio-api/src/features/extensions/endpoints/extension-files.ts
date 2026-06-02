import { readFile } from "node:fs/promises";
import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";

const MAX_EXTENSION_FILE_UPLOAD_BYTES = 25 * 1024 * 1024;

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
    413: {
      description: "Upload too large.",
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
      content: { "application/json": { schema: z.object({ files: z.array(extensionBlobRefSchema) }) } },
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

type FileRow = NonNullable<Awaited<ReturnType<ExtensionsRouteDeps["fileService"]["get"]>>>;

const resolveScope = (projectId: string, query: { scope_type?: string; scope_id?: string }) => {
  const scopeType = query.scope_type ?? "project";
  return {
    scope_type: scopeType,
    scope_id: query.scope_id ?? (scopeType === "project" ? projectId : null),
  };
};

const getProjectExtensionInstance = async (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; extensionInstanceId: string },
) => {
  const instance = await deps.extensionInstancesService.get(input.extensionInstanceId);
  if (!instance || instance.scope_type !== "project" || instance.scope_id !== input.projectId) return null;
  return instance;
};

const fileUrl = (projectId: string, extensionInstanceId: string, fileId: string) =>
  `/v1/projects/${encodeURIComponent(projectId)}/extensions/${encodeURIComponent(extensionInstanceId)}/files/${encodeURIComponent(fileId)}/content`;

const toBlobRef = (projectId: string, extensionInstanceId: string, file: FileRow) => ({
  id: file.id,
  name: file.file_name,
  mimeType: file.mime_type,
  size: file.size_bytes,
  hash: file.hash,
  url: fileUrl(projectId, extensionInstanceId, file.id),
  createdAt: file.created_at,
  updatedAt: file.updated_at,
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

const matchesEtag = (header: string | null, hash: string | null) => {
  if (!header || !hash) return false;
  return header
    .split(",")
    .map((value) => value.trim().replace(/^"|"$/g, ""))
    .includes(hash);
};

const isMissingFileError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export const uploadExtensionFileHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof uploadExtensionFileRoute> => {
  return async (c) => {
    const { extensionInstanceId, projectId } = c.req.valid("param");
    const query = c.req.valid("query");
    const instance = await getProjectExtensionInstance(deps, { extensionInstanceId, projectId });
    if (!instance) return c.json({ error: `Extension instance not found: ${extensionInstanceId}` }, 404);

    const data = Buffer.from(await c.req.arrayBuffer());
    if (data.byteLength > MAX_EXTENSION_FILE_UPLOAD_BYTES) {
      return c.json({ error: "Extension file upload exceeds the maximum size." }, 413);
    }

    const file = await deps.fileService.upload({
      project_id: projectId,
      file_name: readUploadName(c.req.raw.headers),
      file_kind: "extension",
      data,
      mime_type: c.req.raw.headers.get("content-type"),
    });
    const scope = resolveScope(projectId, query);
    await deps.extensionFilesService.attach({
      project_id: projectId,
      extension_instance_id: extensionInstanceId,
      file_id: file.id,
      scope_type: scope.scope_type,
      scope_id: scope.scope_id,
    });
    deps.eventBus.emit("files", "set", file);

    return c.json(toBlobRef(projectId, extensionInstanceId, file), 201);
  };
};

export const listExtensionFilesHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof listExtensionFilesRoute> => {
  return async (c) => {
    const { extensionInstanceId, projectId } = c.req.valid("param");
    const query = c.req.valid("query");
    const instance = await getProjectExtensionInstance(deps, { extensionInstanceId, projectId });
    if (!instance) return c.json({ error: `Extension instance not found: ${extensionInstanceId}` }, 404);

    const scope = resolveScope(projectId, query);
    const files = await deps.extensionFilesService.list({
      project_id: projectId,
      extension_instance_id: extensionInstanceId,
      scope_type: scope.scope_type,
      scope_id: scope.scope_id,
    });

    return c.json({ files: files.map((file) => toBlobRef(projectId, extensionInstanceId, file)) }, 200);
  };
};

export const getExtensionFileContentHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof getExtensionFileContentRoute> => {
  return async (c) => {
    const { extensionInstanceId, fileId, projectId } = c.req.valid("param");
    const file = await deps.extensionFilesService.getOwnedFile({
      project_id: projectId,
      extension_instance_id: extensionInstanceId,
      file_id: fileId,
    });
    if (!file) return c.json({ error: `Extension file not found: ${fileId}` }, 404);

    const headers = {
      "cache-control": "public, max-age=31536000, immutable",
      "content-type": file.mime_type ?? "application/octet-stream",
      ...(file.hash ? { etag: file.hash } : {}),
    };
    if (matchesEtag(c.req.raw.headers.get("if-none-match"), file.hash)) return c.body(null, 304, headers);

    try {
      return c.body(await readFile(file.storage_path), 200, headers);
    } catch (error) {
      if (isMissingFileError(error)) return c.json({ error: `Extension file not found: ${fileId}` }, 404);
      throw error;
    }
  };
};

export const deleteExtensionFileHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof deleteExtensionFileRoute> => {
  return async (c) => {
    const { extensionInstanceId, fileId, projectId } = c.req.valid("param");
    const file = await deps.extensionFilesService.getOwnedFile({
      project_id: projectId,
      extension_instance_id: extensionInstanceId,
      file_id: fileId,
    });
    if (!file) return c.json({ error: `Extension file not found: ${fileId}` }, 404);

    await deps.extensionFilesService.detach({
      project_id: projectId,
      extension_instance_id: extensionInstanceId,
      file_id: fileId,
    });
    await deps.fileService.remove(fileId);
    deps.eventBus.emit("files", "delete", { id: fileId });

    return c.body(null, 204);
  };
};
