import { createRoute, z } from "@hono/zod-openapi";
import { extensionExecutionSchema } from "pstdio-api-contracts";
import { inspectExtensionOwners, restartExtensionOwners, stopExtensionOwners } from "pstdio-extensions";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { canonicalSourcePath } from "../project-extension-runtime-sources";

const params = z.object({ projectId: z.string(), instanceId: z.string() }).strict();
const errorSchema = z.object({ error: z.string(), code: z.string().optional() });
const responses = {
  200: {
    description: "Execution state and projects sharing this source.",
    content: { "application/json": { schema: extensionExecutionSchema } },
  },
  404: {
    description: "Extension instance not found in this project.",
    content: { "application/json": { schema: errorSchema } },
  },
  409: {
    description: "Execution controls are unavailable on this runtime.",
    content: { "application/json": { schema: errorSchema } },
  },
};
export const extensionExecutionRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{instanceId}/execution",
  tags: ["Extensions"],
  request: { params },
  responses,
});
export const controlExtensionExecutionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{instanceId}/execution",
  tags: ["Extensions"],
  description:
    "Stop or restart all source versions shared by the reported projects. Accepted effects are retained and failed commands are not replayed.",
  request: {
    params,
    body: { content: { "application/json": { schema: z.object({ action: z.enum(["stop", "restart"]) }).strict() } } },
  },
  responses,
});

const inspect = async (deps: ExtensionsRouteDeps, sourcePath: string) => {
  const path = canonicalSourcePath(sourcePath);
  const execution = inspectExtensionOwners(path);
  if (!execution.available) return { ...execution, affectedProjects: [] };
  const affectedProjects = [];
  for (const project of await deps.projectService.list()) {
    const sources = await deps.extensionService.listEnabledSourcesForProject(project.id);
    if (sources.some(({ installedSource }) => canonicalSourcePath(installedSource.source_path) === path))
      affectedProjects.push({ id: project.id, name: project.name });
  }
  return { ...inspectExtensionOwners(path), affectedProjects };
};

export const extensionExecutionHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof extensionExecutionRoute> =>
  async (c) => {
    const { projectId, instanceId } = c.req.valid("param");
    const source = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!source) return c.json({ error: "Extension instance not found." }, 404);
    return c.json(await inspect(deps, source.installedSource.source_path), 200);
  };
export const controlExtensionExecutionHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof controlExtensionExecutionRoute> =>
  async (c) => {
    const { projectId, instanceId } = c.req.valid("param");
    const { action } = c.req.valid("json");
    const source = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!source) return c.json({ error: "Extension instance not found." }, 404);
    const path = source.installedSource.source_path;
    if (!inspectExtensionOwners(path).available)
      return c.json(
        { error: "Execution controls are unavailable on this runtime.", code: "extension_execution_unavailable" },
        409,
      );
    if (action === "stop") await stopExtensionOwners(path);
    else await restartExtensionOwners(path);
    return c.json(await inspect(deps, path), 200);
  };
