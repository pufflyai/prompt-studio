import { isAbsolute } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import {
  folderRecoveryErrorCodeSchema,
  projectFolderRecoveryStatusSchema,
  projectFolderSourceRefSchema,
  projectFolderSourceSchema,
  restoreProjectFolderInputSchema,
} from "pstdio-api-contracts";
import { expandHomePath } from "pstdio-paths";
import { AccountRequestError } from "../../../services/account/native-account";
import type { RecoveryAttach } from "../../../services/project-recovery/operations";
import { RecoveryRestoreError } from "../../../services/project-recovery/restore-error";
import type { AppRouteHandler } from "../../../types";
import { rootProviderId } from "../../workspaces/workspace-provider-service";
import type { ProjectsRouteDeps } from "../deps";
import { initializeProjectWorkspace, resolveInitialWorkspace, withFolderCreation } from "../project-folder";

const json = <T extends z.ZodType>(schema: T) => ({ content: { "application/json": { schema } } });
const params = z.object({ id: z.string().min(1) });
const failure = json(
  z.object({
    error: z.string(),
    code: folderRecoveryErrorCodeSchema.optional(),
    path: z.string().nullable().optional(),
  }),
);
const errors = {
  404: { description: "Project not found.", ...failure },
  409: {
    description:
      "The project does not sync with Cloud here, the destination exists, the copy is unavailable, or another operation is running.",
    ...failure,
  },
};
const tags = ["Projects"];
const status = {
  description: "Folder capture, download and restore progress.",
  ...json(projectFolderRecoveryStatusSchema),
};

type Context = Parameters<AppRouteHandler<typeof getFolderRecoveryRoute>>[0];
/** Runs one request against the project's folder recovery owner and maps refusals to 409. */
const withOwner = async <T>(
  deps: ProjectsRouteDeps,
  c: Context,
  work: (owner: Awaited<ReturnType<ProjectsRouteDeps["accountService"]["folderRecovery"]>>) => Promise<T>,
) => {
  const { id } = c.req.valid("param");
  if (!(await deps.projectService.get(id))) return { response: c.json({ error: "Project not found." }, 404) };
  try {
    return { value: await work(await deps.accountService.folderRecovery(id)) };
  } catch (error) {
    if (error instanceof RecoveryRestoreError)
      return { response: c.json({ error: error.message, code: error.code, path: error.path }, 409) };
    if (error instanceof AccountRequestError) return { response: c.json({ error: error.message }, 409) };
    throw error;
  }
};

/** A restored folder becomes the project's folder through the normal attach flow, unless the
 * project already has one here: that folder stays attached and the restored copy stays beside it. */
const attachRestored =
  (deps: ProjectsRouteDeps, projectId: string): RecoveryAttach =>
  (path, enroll) =>
    withFolderCreation(`project-folder:${projectId}`, () =>
      withFolderCreation(path, async () => {
        const home =
          (await deps.workspaceService.getDefault(projectId)) ??
          (await deps.workspaceService.ensureDefault({ project_id: projectId, name: "Project folder" }));
        if (home.root_path || home.provider_ref_json || home.provider_operation_id) return false;
        if (await deps.workspaceService.findByPath(path)) return false;
        await enroll(home.id);
        const initial = await resolveInitialWorkspace({
          initial_workspace: { provider_id: rootProviderId, params: { path } },
        });
        const workspace = await initializeProjectWorkspace(deps, projectId, initial.initial, undefined, {
          restored: true,
        });
        return workspace.root_path === path;
      }),
    );

export const getFolderRecoveryRoute = createRoute({
  method: "get",
  path: "/projects/{id}/folder/recovery",
  tags,
  description: "Folder capture, download and restore progress on this device. Also part of the project's sync status.",
  request: { params },
  responses: { 200: status, ...errors },
});
export const getFolderRecoveryHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof getFolderRecoveryRoute> =>
  async (c) => {
    const result = await withOwner(deps, c, (owner) => owner.folder());
    return result.response ?? c.json(result.value, 200);
  };

export const listFolderSourcesRoute = createRoute({
  method: "get",
  path: "/projects/{id}/folder/sources",
  tags,
  description:
    "Folder copies of this project that your devices completed, with their capture times, sizes and whether every byte is already on this device.",
  request: { params },
  responses: { 200: { description: "Folder copies.", ...json(z.array(projectFolderSourceSchema)) }, ...errors },
});
export const listFolderSourcesHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof listFolderSourcesRoute> =>
  async (c) => {
    const result = await withOwner(deps, c, (owner) => owner.sources());
    return result.response ?? c.json(result.value, 200);
  };

export const captureFolderRoute = createRoute({
  method: "post",
  path: "/projects/{id}/folder/capture",
  tags,
  description: "Capture this device's project folder now. It uploads when Cloud is reachable.",
  request: { params },
  responses: { 202: status, ...errors },
});
export const captureFolderHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof captureFolderRoute> =>
  async (c) => {
    const result = await withOwner(deps, c, async (owner) => {
      owner.capture();
      return owner.folder();
    });
    return result.response ?? c.json(result.value, 202);
  };

export const downloadFolderRoute = createRoute({
  method: "post",
  path: "/projects/{id}/folder/download",
  tags,
  description: "Download one device's folder copy into this device's recovery store, so it can be restored offline.",
  request: { params, body: { required: true, ...json(projectFolderSourceRefSchema) } },
  responses: { 202: status, ...errors },
});
export const downloadFolderHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof downloadFolderRoute> =>
  async (c) => {
    const result = await withOwner(deps, c, async (owner) => {
      await owner.download(c.req.valid("json"));
      return owner.folder();
    });
    return result.response ?? c.json(result.value, 202);
  };

export const restoreFolderRoute = createRoute({
  method: "post",
  path: "/projects/{id}/folder/restore",
  tags,
  description:
    "Restore a folder copy into a new folder that does not exist yet. Every entry is verified before the folder appears; " +
    "it then becomes the project's folder unless the project already has one here. Restored code, hooks and automations are not run.",
  request: { params, body: { required: true, ...json(restoreProjectFolderInputSchema) } },
  responses: { 202: status, 400: { description: "The path is not absolute.", ...failure }, ...errors },
});
export const restoreFolderHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof restoreFolderRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    const input = c.req.valid("json");
    const path = expandHomePath(input.path);
    if (!isAbsolute(path)) return c.json({ error: "Choose an absolute folder path." }, 400);
    const result = await withOwner(deps, c, async (owner) => {
      await owner.restore({ ...input, path }, attachRestored(deps, id));
      return owner.folder();
    });
    return result.response ?? c.json(result.value, 202);
  };

export const cancelFolderRecoveryRoute = createRoute({
  method: "post",
  path: "/projects/{id}/folder/cancel",
  tags,
  description: "Cancel the running folder download or restore. Only its own staging is removed.",
  request: { params },
  responses: { 200: status, ...errors },
});
export const cancelFolderRecoveryHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof cancelFolderRecoveryRoute> =>
  async (c) => {
    const result = await withOwner(deps, c, async (owner) => {
      await owner.cancel();
      return owner.folder();
    });
    return result.response ?? c.json(result.value, 200);
  };
