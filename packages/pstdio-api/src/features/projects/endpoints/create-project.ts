import { createRoute, z } from "@hono/zod-openapi";
import type { ExtensionSetupWarning } from "pstdio-api-contracts";
import { apiLogger } from "../../../lib/logger";
import type { AppRouteHandler } from "../../../types";
import { installDefaultExtensions, syncInstalledExtensionsForProject } from "../../extensions/default-extensions";
import { applyProjectHarnessSelection } from "../../harnesses/apply-harness-selection";
import type { ProjectsRouteDeps } from "../deps";
import { createProjectBodySchema, projectResponseSchema, toProjectResponse } from "../dto";

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
    201: {
      description: "Project created.",
      content: { "application/json": { schema: projectResponseSchema } },
    },
  },
});

const enableSyncedProjectExtensions = async (deps: ProjectsRouteDeps, projectId: string) => {
  const extensions = await deps.extensionService.listProjectExtensionInstances(projectId);
  for (const { instance } of extensions) {
    if (!instance.enabled) await deps.extensionService.setProjectExtensionEnabled(instance.id, true);
  }
};

const messageFromError = (error: unknown) => (error instanceof Error ? error.message : String(error));

const createExtensionWarning = (extension: string, error: unknown): ExtensionSetupWarning => ({
  code: "extension_setup_failed",
  extension,
  message: messageFromError(error),
});

const logExtensionWarning = (warning: ExtensionSetupWarning) => {
  apiLogger.warn(
    {
      code: warning.code,
      event: "projects.extension_setup.warning",
      extension: warning.extension,
      message: warning.message,
    },
    "Project extension setup warning",
  );
};

const setupProjectExtensions = async (deps: ProjectsRouteDeps, projectId: string, installDefaults: boolean) => {
  const warnings: ExtensionSetupWarning[] = [];
  const addWarning = (warning: ExtensionSetupWarning) => {
    warnings.push(warning);
    logExtensionWarning(warning);
  };

  if (installDefaults) {
    try {
      await installDefaultExtensions({
        forceSourceDefaults: process.env.PSTDIO_DISABLE_EMBED_MANIFEST === "1",
        onInstallFailure: ({ error, installName }) => addWarning(createExtensionWarning(installName, error)),
      });
    } catch (error) {
      addWarning(createExtensionWarning("default extensions", error));
    }
  }

  await syncInstalledExtensionsForProject({
    extensionService: deps.extensionService,
    onLoadFailure: ({ error, installName }) => addWarning(createExtensionWarning(installName, error)),
    projectId,
  });
  await enableSyncedProjectExtensions(deps, projectId);

  return warnings;
};

export const createProjectHandler = (deps: ProjectsRouteDeps): AppRouteHandler<typeof createProjectRoute> => {
  return async (c) => {
    const { name, agents } = c.req.valid("json");
    const existingProjects = await deps.projectService.list();
    const project = await deps.projectService.create({ name });

    try {
      const extensionWarnings = await setupProjectExtensions(deps, project.id, existingProjects.length === 0);
      if (agents) {
        await applyProjectHarnessSelection(deps, { projectId: project.id, selectedHarnessIds: agents });
      }

      deps.eventBus.emit("projects", "set", project);

      const response = toProjectResponse(project);
      return c.json(
        extensionWarnings.length > 0 ? { ...response, extension_warnings: extensionWarnings } : response,
        201,
      );
    } catch (error) {
      await deps.projectService.hardDelete(project.id);
      throw error;
    }
  };
};
