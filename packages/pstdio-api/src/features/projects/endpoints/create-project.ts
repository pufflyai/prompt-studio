import { createRoute, z } from "@hono/zod-openapi";
import type { ExtensionSetupWarning } from "pstdio-api-contracts";
import { traceSetupPhase } from "../../../lib/setup-phase";
import { AccountRequestError } from "../../../services/account/native-account";
import type { AppRouteHandler } from "../../../types";
import { applyProjectHarnessSelection } from "../../harnesses/apply-harness-selection";
import { ensureWorkspaceConfig } from "../../workspaces/workspace-config";
import { InvalidWorkspaceParamsError } from "../../workspaces/workspace-provider-params";
import type { ProjectsRouteDeps } from "../deps";
import { createProjectBodySchema, projectResponseSchema, toProjectResponse } from "../dto";
import {
  prepareDefaultProjectExtensions,
  retryProjectExtensions,
  setupProjectExtensions,
} from "../project-extension-setup";
import { initializeProjectWorkspace, resolveInitialWorkspace, withFolderCreation } from "../project-folder";

export const createProjectRoute = createRoute({
  method: "post",
  path: "/projects",
  description: "Create a new project.",
  tags: ["Projects"],
  request: {
    query: z.object({}).strict(),
    body: {
      content: { "application/json": { schema: createProjectBodySchema } },
    },
  },
  responses: {
    200: {
      description: "Existing project opened.",
      content: { "application/json": { schema: projectResponseSchema } },
    },
    400: {
      description: "Invalid project folder.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
    201: {
      description: "Project created.",
      content: { "application/json": { schema: projectResponseSchema } },
    },
  },
});

const openExistingProject = async (
  deps: ProjectsRouteDeps,
  initial: Awaited<ReturnType<typeof resolveInitialWorkspace>>,
) => {
  if (!initial.path) return null;
  const owner = await deps.workspaceService.findByPath(initial.path);
  if (!owner) return null;
  const project = await deps.projectService.get(owner.project_id);
  if (!project) return null;
  let extensionWarnings: ExtensionSetupWarning[] = [];
  // Opening a worktree folder opens its project; only the project folder has setup to repair.
  if (owner.is_default) {
    if (owner.setup_error || owner.initializing || owner.provider_state !== "ready")
      await initializeProjectWorkspace(deps, project.id, initial.initial, async () => {
        extensionWarnings = await retryProjectExtensions(deps, project.id);
        return extensionWarnings;
      });
    else if (owner.root_path) {
      try {
        await ensureWorkspaceConfig(owner.root_path, owner.root_path, owner.id, project.id, deps);
      } catch (error) {
        await deps.workspaceService.setSetupError(owner.id, error instanceof Error ? error.message : String(error));
      }
    }
  }
  const response = toProjectResponse(project);
  return extensionWarnings.length
    ? { ...response, extension_warnings: extensionWarnings, extensionWarnings }
    : response;
};

const openExistingForTeam = async (
  context: Parameters<AppRouteHandler<typeof createProjectRoute>>[0],
  existing: NonNullable<Awaited<ReturnType<typeof openExistingProject>>>,
  team?: Awaited<ReturnType<ProjectsRouteDeps["accountService"]["prepareTeamProject"]>>,
) => {
  if (team && !(await team.matches(existing.id)))
    return context.json({ error: "Choose a new folder for the team project" }, 400);
  await team?.sync(existing.id);
  return context.json({ ...existing, created: false }, 200);
};

const createProjectInFolder = async (
  deps: ProjectsRouteDeps,
  context: Parameters<AppRouteHandler<typeof createProjectRoute>>[0],
  input: ReturnType<typeof createProjectBodySchema.parse>,
  initial: Awaited<ReturnType<typeof resolveInitialWorkspace>>,
  team?: Awaited<ReturnType<ProjectsRouteDeps["accountService"]["prepareTeamProject"]>>,
) => {
  const existingProjects = await deps.projectService.list();
  // A visible first project means its shared defaults are ready for later
  // projects to discover. Concurrent first requests join the install queue.
  const preparationWarnings = existingProjects.length === 0 ? await prepareDefaultProjectExtensions(deps) : [];
  let extensionWarnings: ExtensionSetupWarning[] = preparationWarnings;
  const id = team ? crypto.randomUUID() : undefined;
  if (team && id) await team.reserve(id);
  const project = await deps.projectService.create({ name: initial.name, ...(id && { id }) }, async (project) => {
    await initializeProjectWorkspace(deps, project.id, initial.initial, async () => {
      extensionWarnings = [...preparationWarnings, ...(await setupProjectExtensions(deps, project.id, false))];
      if (input.agents)
        await applyProjectHarnessSelection(deps, { projectId: project.id, selectedHarnessIds: input.agents });
      return extensionWarnings;
    });
  });
  await team?.sync(project.id);
  const response = { ...toProjectResponse(project), created: true };
  return context.json(
    extensionWarnings.length ? { ...response, extension_warnings: extensionWarnings, extensionWarnings } : response,
    201,
  );
};

const openOrCreateProject = async (
  deps: ProjectsRouteDeps,
  context: Parameters<AppRouteHandler<typeof createProjectRoute>>[0],
  input: ReturnType<typeof createProjectBodySchema.parse>,
  initial: Awaited<ReturnType<typeof resolveInitialWorkspace>>,
) => {
  if (input.teamAccountId && !initial.path)
    return context.json({ error: "Choose a local folder for the team project" }, 400);
  const team = input.teamAccountId ? await deps.accountService.prepareTeamProject(input.teamAccountId) : undefined;
  return await withFolderCreation(initial.path, async () => {
    const existing = await openExistingProject(deps, initial);
    if (existing) return openExistingForTeam(context, existing, team);
    return createProjectInFolder(deps, context, input, initial, team);
  });
};

export const createProjectHandler = (deps: ProjectsRouteDeps): AppRouteHandler<typeof createProjectRoute> => {
  return (c) =>
    traceSetupPhase("project.create", {}, async () => {
      const input = c.req.valid("json");
      let initial: Awaited<ReturnType<typeof resolveInitialWorkspace>>;
      try {
        initial = await resolveInitialWorkspace(input);
      } catch (error) {
        return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
      }
      try {
        return await openOrCreateProject(deps, c, input, initial);
      } catch (error) {
        if (error instanceof InvalidWorkspaceParamsError || error instanceof AccountRequestError)
          return c.json({ error: error.message }, 400);
        throw error;
      }
    });
};
