import { isAbsolute } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { chooseProjectFolderInputSchema, projectFolderSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { workspaceResponseSchema } from "../../workspaces/dto";
import { toExtensionWorkspace } from "../../workspaces/extension-workspace";
import { rootProviderId } from "../../workspaces/workspace-provider-service";
import type { ProjectsRouteDeps } from "../deps";
import { cloneGitRemote, readGitRemote } from "../git-remote";
import { initializeProjectWorkspace, resolveInitialWorkspace, withFolderCreation } from "../project-folder";

const error = { content: { "application/json": { schema: z.object({ error: z.string() }) } } };

export const getProjectFolderRoute = createRoute({
  method: "get",
  path: "/projects/{id}/folder",
  tags: ["Projects"],
  description: "Where the project's files are on this device, and the git remote a device without a folder can clone.",
  request: { params: z.object({ id: z.string().min(1) }) },
  responses: {
    200: { description: "Project folder.", content: { "application/json": { schema: projectFolderSchema } } },
    404: { description: "Project not found.", ...error },
  },
});

export const getProjectFolderHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof getProjectFolderRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    if (!(await deps.projectService.get(id))) return c.json({ error: "Project not found." }, 404);
    const home = await deps.workspaceService.getDefault(id);
    const { gitRemote } = await deps.projectInfoService.read(id);
    return c.json({ path: home?.root_path ?? null, gitRemote: gitRemote ?? null }, 200);
  };

export const chooseProjectFolderRoute = createRoute({
  method: "post",
  path: "/projects/{id}/folder",
  tags: ["Projects"],
  description:
    "Give a project its folder on this device, for example a cloud project that came from another device. " +
    "Clone the project's recorded git remote into a new folder, or use a folder that already holds the repository.",
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: { content: { "application/json": { schema: chooseProjectFolderInputSchema } } },
  },
  responses: {
    201: { description: "Folder attached.", content: { "application/json": { schema: workspaceResponseSchema } } },
    400: { description: "Invalid folder, or the clone failed.", ...error },
    404: { description: "Project not found.", ...error },
    409: {
      description: "The project already has a folder, has no git remote, or the folder holds another repository.",
      ...error,
    },
  },
});

const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

// Puts the project's repository in the folder, or explains why the folder cannot hold it.
const prepareFolder = async (gitRemote: string | undefined, path: string, clone: boolean) => {
  if (!clone) {
    if (gitRemote && (await readGitRemote(path)) !== gitRemote)
      return { status: 409, error: `This folder does not hold the project's repository ${gitRemote}.` } as const;
    return null;
  }
  if (!gitRemote) return { status: 409, error: "This project has no git remote to clone." } as const;
  try {
    await cloneGitRemote(gitRemote, path);
    return null;
  } catch (cause) {
    return { status: 400, error: message(cause) } as const;
  }
};

export const chooseProjectFolderHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof chooseProjectFolderRoute> =>
  async (c) => {
    const { id } = c.req.valid("param");
    const { path, clone } = c.req.valid("json");
    if (!(await deps.projectService.get(id))) return c.json({ error: "Project not found." }, 404);
    if (!isAbsolute(path)) return c.json({ error: "Choose an absolute folder path." }, 400);
    return withFolderCreation(path, async () => {
      const home = await deps.workspaceService.getDefault(id);
      if (home?.root_path || home?.provider_ref_json || home?.provider_operation_id)
        return c.json({ error: "This project already has a folder on this device." }, 409);
      const refused = await prepareFolder((await deps.projectInfoService.read(id)).gitRemote, path, clone);
      if (refused) return c.json({ error: refused.error }, refused.status);
      let initial: Awaited<ReturnType<typeof resolveInitialWorkspace>>;
      try {
        initial = await resolveInitialWorkspace({
          initial_workspace: { provider_id: rootProviderId, params: { path } },
        });
      } catch (cause) {
        return c.json({ error: message(cause) }, 400);
      }
      if (await deps.workspaceService.findByPath(initial.path!))
        return c.json({ error: "This folder already belongs to another workspace." }, 409);
      const workspace = await initializeProjectWorkspace(deps, id, initial.initial);
      return c.json({ ...workspace, ...toExtensionWorkspace(workspace) }, 201);
    });
  };
