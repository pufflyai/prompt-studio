import { createRoute, z } from "@hono/zod-openapi";
import { bindEnvironmentInputSchema, environmentBindingSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { workspaceResponseSchema } from "../../workspaces/dto";
import { toExtensionWorkspace } from "../../workspaces/extension-workspace";
import { rootProviderId } from "../../workspaces/workspace-provider-service";
import type { ProjectsRouteDeps } from "../deps";
import { initializeProjectWorkspace, resolveInitialWorkspace, withFolderCreation } from "../project-folder";

const response = {
  content: { "application/json": { schema: environmentBindingSchema.extend({ workspace: workspaceResponseSchema }) } },
};
const error = { content: { "application/json": { schema: z.object({ error: z.string() }) } } };
type Workspace = Pick<
  NonNullable<Awaited<ReturnType<ProjectsRouteDeps["workspaceService"]["getDefault"]>>>,
  "project_id" | "is_default" | "root_path" | "execution_kind" | "provider_ref_json" | "provider_operation_id"
>;
const hasBinding = (workspace: Workspace | null) =>
  Boolean(workspace && (workspace.root_path || workspace.provider_ref_json || workspace.provider_operation_id));
const bindingConflict = (id: string, path: string, home: Workspace | null, folder: Workspace | null) => {
  if (folder && (folder.project_id !== id || !folder.is_default))
    return "This folder already belongs to another workspace.";
  if (home && hasBinding(home) && (home.root_path !== path || home.execution_kind !== "local"))
    return "This workbench already has a different local binding.";
  return null;
};
export const bindEnvironmentRoute = createRoute({
  method: "put",
  path: "/projects/{id}/environment-binding",
  tags: ["Projects"],
  description:
    "Bind an existing workbench identity to a folder in this local environment. This does not grant relay access.",
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: { content: { "application/json": { schema: bindEnvironmentInputSchema } } },
  },
  responses: {
    200: { description: "Existing local binding.", ...response },
    201: { description: "Local binding created.", ...response },
    400: { description: "Invalid local folder.", ...error },
    409: { description: "Environment, workbench, or folder has a different owner.", ...error },
  },
});

export const bindEnvironmentHandler =
  (deps: ProjectsRouteDeps): AppRouteHandler<typeof bindEnvironmentRoute> =>
  async (c) => {
    const input = c.req.valid("json");
    const { id } = c.req.valid("param");
    const identity = await deps.environmentService.get();
    if (input.environmentId !== identity.environmentId)
      return c.json({ error: "Target belongs to another environment." }, 409);
    if (input.initial_workspace.provider_id !== rootProviderId)
      return c.json({ error: "An environment binding requires a local folder." }, 400);
    let initial: Awaited<ReturnType<typeof resolveInitialWorkspace>>;
    try {
      initial = await resolveInitialWorkspace(input);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
    return withFolderCreation(`workbench:${identity.environmentId}:${id}`, () =>
      withFolderCreation(initial.path, async () => {
        const project = await deps.projectService.get(id);
        const home = project ? await deps.workspaceService.getDefault(id) : null;
        const folderOwner = await deps.workspaceService.findByPath(initial.path!);
        const conflict = bindingConflict(id, initial.path!, home, folderOwner);
        if (conflict) return c.json({ error: conflict }, 409);
        if (!project) await deps.projectService.create({ id, name: input.name });
        // Workspace provisioning owns paths and config. Shared workbench identity never
        // carries a default folder or another environment's workspace ID.
        const workspace = await initializeProjectWorkspace(deps, id, initial.initial);
        return c.json(
          { ...identity, workbenchId: id, workspace: { ...workspace, ...toExtensionWorkspace(workspace) } },
          hasBinding(home) ? 200 : 201,
        );
      }),
    );
  };
