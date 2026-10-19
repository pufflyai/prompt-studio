import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppBindings, AppRouteHandler } from "../../../types";
import { type AutomationDeps, assignAutomation, listAutomations, setAutomationEnabled } from "./catalog";
import { openAutomationRuns } from "./runs";

const params = z.strictObject({ projectId: z.string() });
const body = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("assign"), scheduleId: z.string(), workspaceId: z.string() }),
  z.strictObject({
    kind: z.literal("enabled"),
    scheduleId: z.string(),
    enabled: z.boolean(),
    expectedRevision: z.string(),
  }),
]);
const responses = {
  200: {
    description: "Automation state or locally saved change.",
    content: { "application/json": { schema: z.unknown() } },
  },
  404: {
    description: "Workbench not found.",
    content: { "application/json": { schema: z.object({ error: z.string() }) } },
  },
  409: {
    description: "Automation could not be changed.",
    content: { "application/json": { schema: z.object({ error: z.string() }) } },
  },
};
const path = "/projects/{projectId}/automation-targets";
const get = createRoute({ method: "get", path, tags: ["Extensions"], request: { params }, responses });
const post = createRoute({
  method: "post",
  path,
  tags: ["Extensions"],
  request: { params, body: { content: { "application/json": { schema: body } } } },
  responses,
});
const runs = createRoute({ method: "get", path: `${path}/runs`, tags: ["Extensions"], request: { params }, responses });
export const automationTargetRoutes = (deps: AutomationDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.openapi(get, async (c) => {
    const { projectId } = c.req.valid("param");
    if (!(await deps.projectService.get(projectId))) return c.json({ error: "Workbench not found" }, 404);
    return c.json(await listAutomations(deps, projectId), 200);
  });
  const listRuns: AppRouteHandler<typeof runs> = async (c) => {
    const { projectId } = c.req.valid("param");
    if (!(await deps.projectService.get(projectId))) return c.json({ error: "Workbench not found" }, 404);
    const storage = await openAutomationRuns(deps, projectId);
    return c.json(
      (await storage.records.list())
        .filter((record) => record.value && typeof record.value === "object")
        .map((record) => record.value as Record<string, unknown>),
      200,
    );
  };
  routes.openapi(runs, listRuns);
  routes.openapi(post, async (c) => {
    const { projectId } = c.req.valid("param");
    if (!(await deps.projectService.get(projectId))) return c.json({ error: "Workbench not found" }, 404);
    const input = c.req.valid("json");
    try {
      const outcome =
        input.kind === "assign"
          ? await assignAutomation(deps, projectId, input)
          : await setAutomationEnabled(deps, projectId, input.scheduleId, input.expectedRevision, input.enabled);
      return c.json(outcome, 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Automation could not be changed" }, 409);
    }
  });
  return routes;
};
