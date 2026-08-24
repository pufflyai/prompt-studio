import { readFile } from "node:fs/promises";
import { createRoute, z } from "@hono/zod-openapi";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppRouteHandler } from "../../../types";
import { findEnabledSource } from "../command-environment/types";
import type { ExtensionsRouteDeps } from "../deps";
import {
  readExtensionFileUpload,
  resolveExtensionFileScope,
  storeExtensionFile,
  toExtensionBlobRef,
} from "./extension-file-storage";

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
    413: {
      description: "Upload too large.",
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

const matchesEtag = (header: string | null, hash: string | null) => {
  if (!header || !hash) return false;
  return header
    .split(",")
    .map((value) => value.trim().replace(/^"|"$/g, ""))
    .includes(hash);
};

const isMissingFileError = (error: unknown) =>
  typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT";

export const uploadExtensionCommandFileHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof uploadExtensionCommandFileRoute> => {
  return async (c) => {
    const { commandId, projectId } = c.req.valid("param");

    try {
      const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
      const command =
        snapshot.runtime.commands.find((candidate) => candidate.id === commandId) ??
        snapshot.runtime.privateHandlers.find((candidate) => candidate.id === commandId);
      const enabledSource = command ? findEnabledSource(snapshot.enabledSources, command.extensionId) : undefined;
      if (!enabledSource) return c.json({ error: `Extension command not found: ${commandId}` }, 404);

      const data = await readExtensionFileUpload(c.req);
      if (!data) return c.json({ error: "Extension file upload exceeds the maximum size." }, 413);

      const file = await storeExtensionFile(deps, {
        data,
        extensionInstanceId: enabledSource.instance.id,
        headers: c.req.raw.headers,
        projectId,
        scopeId: projectId,
        scopeType: "project",
      });
      if (!file) return c.json({ error: `Extension command not found: ${commandId}` }, 404);

      return c.json(toExtensionBlobRef(projectId, enabledSource.instance.id, file), 201);
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };
};

export const uploadExtensionFileHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof uploadExtensionFileRoute> => {
  return async (c) => {
    const { extensionInstanceId, projectId } = c.req.valid("param");
    const query = c.req.valid("query");

    const data = await readExtensionFileUpload(c.req);
    if (!data) return c.json({ error: "Extension file upload exceeds the maximum size." }, 413);

    const scope = resolveExtensionFileScope(projectId, query);
    const file = await storeExtensionFile(deps, {
      data,
      extensionInstanceId,
      headers: c.req.raw.headers,
      projectId,
      scopeId: scope.scope_id,
      scopeType: scope.scope_type,
    });
    if (!file) return c.json({ error: `Extension instance not found: ${extensionInstanceId}` }, 404);

    return c.json(toExtensionBlobRef(projectId, extensionInstanceId, file), 201);
  };
};

export const listExtensionFilesHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof listExtensionFilesRoute> => {
  return async (c) => {
    const { extensionInstanceId, projectId } = c.req.valid("param");
    const query = c.req.valid("query");

    const scope = resolveExtensionFileScope(projectId, query);
    const files = await deps.extensionFileService.list({
      project_id: projectId,
      extension_instance_id: extensionInstanceId,
      scope_type: scope.scope_type,
      scope_id: scope.scope_id,
    });
    if (!files) return c.json({ error: `Extension instance not found: ${extensionInstanceId}` }, 404);

    return c.json(
      {
        files: files.map((file) => toExtensionBlobRef(projectId, extensionInstanceId, file)),
      },
      200,
    );
  };
};

export const getExtensionFileContentHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof getExtensionFileContentRoute> => {
  return async (c) => {
    const { extensionInstanceId, fileId, projectId } = c.req.valid("param");
    const file = await deps.extensionFileService.getOwnedFile({
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
    const removed = await deps.extensionFileService.remove({
      project_id: projectId,
      extension_instance_id: extensionInstanceId,
      file_id: fileId,
    });
    if (!removed) return c.json({ error: `Extension file not found: ${fileId}` }, 404);

    return c.body(null, 204);
  };
};
