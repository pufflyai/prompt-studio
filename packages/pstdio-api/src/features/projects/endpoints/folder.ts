import { realpath } from "node:fs/promises";
import { basename, dirname, isAbsolute, join } from "node:path";
import { createRoute, z } from "@hono/zod-openapi";
import { chooseProjectFolderInputSchema, projectFolderSchema } from "pstdio-api-contracts";
import { expandHomePath } from "pstdio-paths";
import type { AppRouteHandler } from "../../../types";
import { workspaceResponseSchema } from "../../workspaces/dto";
import { toExtensionWorkspace } from "../../workspaces/extension-workspace";
import { rootProviderId } from "../../workspaces/workspace-provider-service";
import type { ProjectsRouteDeps } from "../deps";
import { cloneGitRemote, readGitRemote, sameRepository } from "../git-remote";
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
const prepareFolder = async (deps: ProjectsRouteDeps, gitRemote: string | undefined, path: string, clone: boolean) => {
  if (!clone) {
    const local = gitRemote ? await readGitRemote(path) : undefined;
    if (gitRemote && !(local && sameRepository(local, gitRemote)))
      return { status: 409, error: `This folder does not hold the project's repository ${gitRemote}.` } as const;
    return null;
  }
  if (!gitRemote) return { status: 409, error: "This project has no git remote to clone." } as const;
  // A workspace keeps its folder after the files are removed. Check before cloning, so no clone is left behind.
  const target = join(await realpath(dirname(path)).catch(() => dirname(path)), basename(path));
  if (await deps.workspaceService.findByPath(target))
    return { status: 409, error: "This folder already belongs to another workspace." } as const;
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
    const { clone } = c.req.valid("json");
    const path = expandHomePath(c.req.valid("json").path);
    if (!(await deps.projectService.get(id))) return c.json({ error: "Project not found." }, 404);
    if (!isAbsolute(path)) return c.json({ error: "Choose an absolute folder path." }, 400);
    // One folder choice per project at a time, and one project per folder.
    return withFolderCreation(`project-folder:${id}`, () =>
      withFolderCreation(path, async () => {
        const home = await deps.workspaceService.getDefault(id);
        if (home?.root_path || home?.provider_ref_json || home?.provider_operation_id)
          return c.json({ error: "This project already has a folder on this device." }, 409);
        const { gitRemote } = await deps.projectInfoService.read(id);
        const refused = await prepareFolder(deps, gitRemote, path, clone);
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
      }),
    );
  };
