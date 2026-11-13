import { listWorkspaceFilesInputSchema, renameWorkspaceInputSchema } from "pstdio-api-contracts";
import type { ExtensionWorkspacesApi } from "pstdio-api-contracts/extension-kernel";
import {
  createFileMount,
  createReadBoundary,
  createWorkspaceFilesMount,
  normalizeMountRelativePath,
} from "pstdio-extensions";
import { getWorktreeDiffFile, getWorktreeDiffSummary, getWorktreeDiffSummaryFiles, git } from "pstdio-wt";
import { z } from "zod";
import { createObservedFileMount, observeWorkspaceFileBytes } from "../../../services/shared-files/observed-file-mount";
import { toExtensionWorkspace } from "../../workspaces/extension-workspace";
import { resolveBase, resolveHeadLabel } from "../../workspaces/resolve-base";
import {
  MAX_FILE_BYTES,
  readWorkspaceFile,
  toApiEntry,
  UnsupportedWorkspaceFileError,
} from "../../workspaces/workspace-file-content";
import { resolveWorkspaceExecutionTarget } from "../../workspaces/workspace-provider-service";
import type { ExtensionsRouteDeps } from "../deps";

type PresentationApi = Pick<
  ExtensionWorkspacesApi,
  | "rename"
  | "listFiles"
  | "readFile"
  | "createDirectory"
  | "createFile"
  | "writeFile"
  | "moveEntry"
  | "deleteEntry"
  | "diffFiles"
  | "diffFile"
  | "diffSummary"
>;

export const createWorkspacePresentationApi = (
  deps: ExtensionsRouteDeps,
  input: { projectId: string; signal?: AbortSignal },
) => {
  const read = createReadBoundary(input.signal);
  const requireWorkspace = (id: string) =>
    read(async () => {
      const workspace = await deps.workspaceService.get(id);
      if (!workspace || workspace.project_id !== input.projectId || workspace.deleted_at)
        throw new Error(`Workspace not found: ${id}`);
      return workspace;
    });
  const target = async (id: string, access: "files:read" | "files:write" | "diff") => {
    await requireWorkspace(id);
    const context = await read(() => resolveWorkspaceExecutionTarget(deps, id, access));
    if (!context) throw new Error(`Workspace has no ready local ${access} target: ${id}`);
    return context;
  };
  const files = async (id: string, access: "files:read" | "files:write") => {
    const context = await target(id, access);
    const mount = createWorkspaceFilesMount(context.root, { signal: input.signal });
    return {
      ...context,
      mount: {
        ...mount,
        readFile: async (path: string, maxBytes: number) => {
          const file = await mount.readFile(path, maxBytes);
          observeWorkspaceFileBytes(context.root, path, file.bytes);
          return file;
        },
        writeTextFile: async (path: string, content: string, maxBytes: number) => {
          const observed = createObservedFileMount(context.root, {
            ...createFileMount(context.root, input.signal),
            // Keep the protected existing-file writer; the observation layer only guards its revision.
            writeText: async (path, value) => {
              await mount.writeTextFile(path, value, maxBytes);
            },
          });
          await observed.writeText(path, content);
        },
      },
    };
  };
  const diff = async (id: string, mode: "current" | "fork_point") => {
    const context = await target(id, "diff");
    z.enum(["current", "fork_point"]).parse(mode);
    if ((await read(() => git(context.root, ["rev-parse", "--is-inside-work-tree"]))) !== "true")
      throw new Error(`Workspace has no available Git working tree: ${id}`);
    const base = mode === "current" ? { sha: "HEAD", label: "HEAD" } : await read(() => resolveBase(context.root));
    return { ...context, base };
  };
  return {
    rename: async (id, value) => {
      await requireWorkspace(id);
      const { name } = renameWorkspaceInputSchema.parse(value);
      input.signal?.throwIfAborted();
      const workspace = await deps.workspaceService.rename(id, name);
      if (!workspace) throw new Error(`Workspace not found: ${id}`);
      return toExtensionWorkspace(workspace);
    },
    listFiles: (id, value = {}) =>
      read(async () => {
        const { mount } = await files(id, "files:read");
        const { path = "", query, limit = 500 } = listWorkspaceFilesInputSchema.parse(value);
        const result = query
          ? await mount.searchEntries(query, limit, path)
          : { entries: await mount.listEntries(path), truncated: false };
        return {
          workspace_id: id,
          path,
          entries: result.entries.slice(0, limit).map(toApiEntry),
          truncated: result.truncated || result.entries.length > limit,
        };
      }),
    readFile: (id, path) =>
      read(async () => {
        const { workspace, mount } = await files(id, "files:read");
        const file = await readWorkspaceFile(workspace, mount, path);
        return { ...file, editable: file.editable && workspace.provider_capabilities_json.files === "write" };
      }),
    createDirectory: async (id, path) => {
      const { mount } = await files(id, "files:write");
      input.signal?.throwIfAborted();
      await mount.createDirectory(path);
      return { path, name: path.split("/").at(-1) ?? path, type: "directory" as const };
    },
    createFile: async (id, path, value) => {
      const { workspace, mount } = await files(id, "files:write");
      input.signal?.throwIfAborted();
      await mount.createTextFile(path, value.content, MAX_FILE_BYTES);
      return readWorkspaceFile(workspace, mount, path);
    },
    writeFile: async (id, path, value) => {
      const { workspace, mount } = await files(id, "files:write");
      const current = await read(() => readWorkspaceFile(workspace, mount, path));
      if (!current.editable) throw new UnsupportedWorkspaceFileError(`Workspace file is not editable: ${path}`);
      input.signal?.throwIfAborted();
      await mount.writeTextFile(path, value.content, MAX_FILE_BYTES);
      return readWorkspaceFile(workspace, mount, path);
    },
    moveEntry: async (id, path, destinationPath) => {
      const { mount } = await files(id, "files:write");
      input.signal?.throwIfAborted();
      await mount.moveEntry(path, destinationPath);
    },
    deleteEntry: async (id, path) => {
      const { mount } = await files(id, "files:write");
      input.signal?.throwIfAborted();
      await mount.deleteEntry(path);
    },
    diffFiles: (id, mode) =>
      read(async () => {
        const { root, base } = await diff(id, mode);
        const result = await read(() => getWorktreeDiffSummaryFiles({ worktreePath: root, base: base.sha }));
        return {
          workspace_id: id,
          base_ref: base.label,
          head_ref: await read(() => resolveHeadLabel(root)),
          ...result,
        };
      }),
    diffFile: (id, mode, path) =>
      read(async () => {
        const { root, base } = await diff(id, mode);
        const normalized = normalizeMountRelativePath(path);
        if (!normalized || normalized === ".git" || normalized.startsWith(".git/"))
          throw new Error("Select a workspace file outside Git metadata.");
        return getWorktreeDiffFile({ worktreePath: root, base: base.sha, filePath: normalized });
      }),
    diffSummary: (id, mode) =>
      read(async () => {
        const { root, base } = await diff(id, mode);
        return {
          workspace_id: id,
          ...(await read(() => getWorktreeDiffSummary({ worktreePath: root, base: base.sha, signal: input.signal }))),
        };
      }),
  } satisfies PresentationApi;
};
