import { createWorkspaceFilesMount, WorkspaceFileAccessError, type WorkspaceMountEntry } from "pstdio-extensions";
import type { AppRouteHandler } from "../../../types";
import type { WorkspacesRouteDeps } from "../deps";
import { resolveWorkspaceExecutionTarget } from "../workspace-provider-service";
import type {
  createWorkspaceDirectoryRoute,
  createWorkspaceFileRoute,
  deleteWorkspaceEntryRoute,
  getWorkspaceFileRoute,
  listWorkspaceFilesRoute,
  moveWorkspaceEntryRoute,
  writeWorkspaceFileRoute,
} from "./workspace-file-routes";

export {
  createWorkspaceDirectoryRoute,
  createWorkspaceFileRoute,
  deleteWorkspaceEntryRoute,
  getWorkspaceFileRoute,
  listWorkspaceFilesRoute,
  moveWorkspaceEntryRoute,
  writeWorkspaceFileRoute,
} from "./workspace-file-routes";

const MAX_FILE_BYTES = 1024 * 1024;
const DEFAULT_LIST_LIMIT = 500;

const mimeTypesByExtension: Record<string, string> = {
  avif: "image/avif",
  bmp: "image/bmp",
  css: "text/css",
  gif: "image/gif",
  htm: "text/html",
  html: "text/html",
  ico: "image/x-icon",
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  js: "text/javascript",
  json: "application/json",
  jsonc: "application/json",
  jsx: "text/javascript",
  md: "text/markdown",
  mjs: "text/javascript",
  png: "image/png",
  svg: "image/svg+xml",
  ts: "text/typescript",
  tsx: "text/typescript",
  txt: "text/plain",
  webp: "image/webp",
  xml: "application/xml",
  yaml: "application/yaml",
  yml: "application/yaml",
};

class UnsupportedWorkspaceFileError extends Error {}

const fileNameOf = (path: string) => path.split("/").at(-1) ?? path;

const mimeTypeOf = (fileName: string) => {
  const extension = fileName.includes(".") ? (fileName.split(".").at(-1)?.toLocaleLowerCase() ?? "") : "";
  return mimeTypesByExtension[extension] ?? "text/plain";
};

const isImageMimeType = (mimeType: string) => mimeType.startsWith("image/");

const decodeText = (bytes: Uint8Array, path: string) => {
  if (bytes.includes(0)) throw new UnsupportedWorkspaceFileError(`Workspace file is not supported text: ${path}`);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new UnsupportedWorkspaceFileError(`Workspace file is not supported text: ${path}`);
  }
};

const toApiEntry = (entry: WorkspaceMountEntry) => ({
  path: entry.path,
  name: entry.name,
  type: entry.type,
  ...(entry.size !== undefined ? { size: entry.size } : {}),
  ...(entry.modifiedAt ? { modified_at: entry.modifiedAt } : {}),
});

const resolveWorkspaceMount = async (deps: WorkspacesRouteDeps, id: string, access: "files:read" | "files:write") => {
  const context = await resolveWorkspaceExecutionTarget(deps, id, access);
  if (!context) return undefined;
  return { mount: createWorkspaceFilesMount(context.root), workspace: context.workspace };
};

const readWorkspaceFile = async (
  workspace: { id: string },
  mount: ReturnType<typeof createWorkspaceFilesMount>,
  path: string,
) => {
  const file = await mount.readFile(path, MAX_FILE_BYTES);
  const fileName = fileNameOf(path);
  const mimeType = mimeTypeOf(fileName);
  if (isImageMimeType(mimeType)) {
    const base64 = Buffer.from(file.bytes).toString("base64");
    return {
      workspace_id: workspace.id,
      path,
      file_name: fileName,
      mime_type: mimeType,
      size: file.size,
      encoding: "base64" as const,
      data_url: `data:${mimeType};base64,${base64}`,
      editable: false,
    };
  }
  return {
    workspace_id: workspace.id,
    path,
    file_name: fileName,
    mime_type: mimeType,
    size: file.size,
    encoding: "utf8" as const,
    content: decodeText(file.bytes, path),
    editable: true,
  };
};

const mapFileError = (error: unknown) => {
  if (error instanceof WorkspaceFileAccessError) {
    if (error.code === "already-exists") throw error;
    if (error.code === "too-large") return { message: error.message, status: 413 as const };
    if (error.code === "not-found") return { message: error.message, status: 404 as const };
    return { message: error.message, status: 415 as const };
  }
  if (error instanceof UnsupportedWorkspaceFileError) return { message: error.message, status: 415 as const };
  if (error instanceof Error && error.message.includes("escapes mount root")) {
    return { message: error.message, status: 400 as const };
  }
  if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
    return { message: "Workspace file not found.", status: 404 as const };
  }
  throw error;
};

const mapWorkspaceMutationError = (error: unknown) => {
  if (error instanceof WorkspaceFileAccessError && error.code === "already-exists") {
    return { message: error.message, status: 409 as const };
  }
  if (error instanceof WorkspaceFileAccessError && error.code === "invalid-target") {
    return { message: error.message, status: 400 as const };
  }
  return mapFileError(error);
};

const mapWorkspaceDirectoryError = (error: unknown) => {
  if (error instanceof WorkspaceFileAccessError) {
    if (error.code === "already-exists") return { message: error.message, status: 409 as const };
    if (error.code === "not-found") return { message: error.message, status: 404 as const };
    return { message: error.message, status: 415 as const };
  }
  if (error instanceof Error && error.message.includes("escapes mount root")) {
    return { message: error.message, status: 400 as const };
  }
  if (error instanceof Error && "code" in error && (error as NodeJS.ErrnoException).code === "ENOENT") {
    return { message: "Workspace directory not found.", status: 404 as const };
  }
  throw error;
};

export const listWorkspaceFilesHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof listWorkspaceFilesRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { limit = DEFAULT_LIST_LIMIT, path = "", query } = c.req.valid("query");
    const context = await resolveWorkspaceMount(deps, id, "files:read");
    if (!context) return c.json({ error: `Workspace not found or has no file root: ${id}` }, 404);

    try {
      if (query) {
        const result = await context.mount.searchEntries(query, limit, path);
        return c.json(
          {
            workspace_id: context.workspace.id,
            path,
            entries: result.entries.map(toApiEntry),
            truncated: result.truncated,
          },
          200,
        );
      }

      const entries = await context.mount.listEntries(path);
      return c.json(
        {
          workspace_id: context.workspace.id,
          path,
          entries: entries.slice(0, limit).map(toApiEntry),
          truncated: entries.length > limit,
        },
        200,
      );
    } catch (error) {
      const mapped = mapFileError(error);
      return c.json({ error: mapped.message }, mapped.status);
    }
  };
};

export const getWorkspaceFileHandler = (deps: WorkspacesRouteDeps): AppRouteHandler<typeof getWorkspaceFileRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { path } = c.req.valid("query");
    const context = await resolveWorkspaceMount(deps, id, "files:read");
    if (!context) return c.json({ error: `Workspace not found or has no file root: ${id}` }, 404);

    try {
      return c.json(await readWorkspaceFile(context.workspace, context.mount, path), 200);
    } catch (error) {
      const mapped = mapFileError(error);
      return c.json({ error: mapped.message }, mapped.status);
    }
  };
};

export const writeWorkspaceFileHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof writeWorkspaceFileRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { path } = c.req.valid("query");
    const { content } = c.req.valid("json");
    const context = await resolveWorkspaceMount(deps, id, "files:write");
    if (!context) return c.json({ error: `Workspace not found or has no file root: ${id}` }, 404);

    try {
      const current = await readWorkspaceFile(context.workspace, context.mount, path);
      if (!current.editable) throw new UnsupportedWorkspaceFileError(`Workspace file is not editable: ${path}`);
      await context.mount.writeTextFile(path, content, MAX_FILE_BYTES);
      return c.json(await readWorkspaceFile(context.workspace, context.mount, path), 200);
    } catch (error) {
      const mapped = mapFileError(error);
      return c.json({ error: mapped.message }, mapped.status);
    }
  };
};

export const createWorkspaceFileHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof createWorkspaceFileRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { path } = c.req.valid("query");
    const { content } = c.req.valid("json");
    const context = await resolveWorkspaceMount(deps, id, "files:write");
    if (!context) return c.json({ error: `Workspace not found or has no file root: ${id}` }, 404);

    try {
      await context.mount.createTextFile(path, content, MAX_FILE_BYTES);
      return c.json(await readWorkspaceFile(context.workspace, context.mount, path), 201);
    } catch (error) {
      const mapped = mapWorkspaceMutationError(error);
      return c.json({ error: mapped.message }, mapped.status);
    }
  };
};

export const createWorkspaceDirectoryHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof createWorkspaceDirectoryRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { path } = c.req.valid("query");
    const context = await resolveWorkspaceMount(deps, id, "files:write");
    if (!context) return c.json({ error: `Workspace not found or has no file root: ${id}` }, 404);

    try {
      await context.mount.createDirectory(path);
      return c.json({ path, name: fileNameOf(path), type: "directory" as const }, 201);
    } catch (error) {
      const mapped = mapWorkspaceDirectoryError(error);
      return c.json({ error: mapped.message }, mapped.status);
    }
  };
};

export const moveWorkspaceEntryHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof moveWorkspaceEntryRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { path } = c.req.valid("query");
    const { destination_path: destinationPath } = c.req.valid("json");
    const context = await resolveWorkspaceMount(deps, id, "files:write");
    if (!context) return c.json({ error: `Workspace not found or has no file root: ${id}` }, 404);

    try {
      await context.mount.moveEntry(path, destinationPath);
      return c.body(null, 204);
    } catch (error) {
      const mapped = mapWorkspaceMutationError(error);
      return c.json({ error: mapped.message }, mapped.status);
    }
  };
};

export const deleteWorkspaceEntryHandler = (
  deps: WorkspacesRouteDeps,
): AppRouteHandler<typeof deleteWorkspaceEntryRoute> => {
  return async (c) => {
    const { id } = c.req.valid("param");
    const { path } = c.req.valid("query");
    const context = await resolveWorkspaceMount(deps, id, "files:write");
    if (!context) return c.json({ error: `Workspace not found or has no file root: ${id}` }, 404);

    try {
      await context.mount.deleteEntry(path);
      return c.body(null, 204);
    } catch (error) {
      const mapped = mapFileError(error);
      return c.json({ error: mapped.message }, mapped.status);
    }
  };
};
