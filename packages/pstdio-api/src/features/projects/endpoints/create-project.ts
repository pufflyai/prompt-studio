import { createRoute, z } from "@hono/zod-openapi";
import type { ExtensionSetupWarning } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { applyProjectHarnessSelection } from "../../harnesses/apply-harness-selection";
import type { ProjectsRouteDeps } from "../deps";
import { createProjectBodySchema, projectResponseSchema, toProjectResponse } from "../dto";
import { retryProjectExtensions, setupProjectExtensions } from "../project-extension-setup";
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
  const home = await deps.workspaceService.findDefaultByPath(initial.path);
  if (!home) return null;
  const project = await deps.projectService.get(home.project_id);
  if (!project) return null;
  let extensionWarnings: ExtensionSetupWarning[] = [];
  if (home.setup_error || home.initializing || home.provider_state !== "ready")
    await initializeProjectWorkspace(deps, project.id, initial.initial, async () => {
      extensionWarnings = await retryProjectExtensions(deps, project.id);
      return extensionWarnings;
    });
  const response = toProjectResponse(project);
  return extensionWarnings.length ? { ...response, extension_warnings: extensionWarnings } : response;
};

export const createProjectHandler = (deps: ProjectsRouteDeps): AppRouteHandler<typeof createProjectRoute> => {
  return async (c) => {
    const input = c.req.valid("json");
    let initial: Awaited<ReturnType<typeof resolveInitialWorkspace>>;
    try {
      initial = await resolveInitialWorkspace(input);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
    return withFolderCreation(initial.path, async () => {
      const existing = await openExistingProject(deps, initial);
      if (existing) return c.json(existing, 200);
      const existingProjects = await deps.projectService.list();
      let extensionWarnings: ExtensionSetupWarning[] = [];
      const project = await deps.projectService.create({ name: initial.name }, async (project) => {
        await initializeProjectWorkspace(deps, project.id, initial.initial, async () => {
          extensionWarnings = await setupProjectExtensions(deps, project.id, existingProjects.length === 0);
          if (input.agents)
            await applyProjectHarnessSelection(deps, { projectId: project.id, selectedHarnessIds: input.agents });
          return extensionWarnings;
        });
      });
      const response = toProjectResponse(project);
      return c.json(extensionWarnings.length ? { ...response, extension_warnings: extensionWarnings } : response, 201);
    });
  };
};
