import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps } from "./deps";
import { assignDeviceAutomation, deviceAutomationSchema, listDeviceAutomations } from "./device-automations";
import { automationRunSchema, openAutomationRuns } from "./extension-schedule-admission/runs";

const params = z.object({ projectId: z.string().min(1) });
const base = "/projects/{projectId}/extensions/automations";
const listRoute = createRoute({
  method: "get",
  path: base,
  tags: ["Extensions"],
  request: { params },
  responses: {
    200: {
      description: "Device assignments for this project.",
      content: { "application/json": { schema: z.array(deviceAutomationSchema) } },
    },
  },
});
const assignRoute = createRoute({
  method: "post",
  path: base,
  tags: ["Extensions"],
  request: {
    params,
    body: {
      content: {
        "application/json": {
          schema: z.object({ scheduleId: z.string().min(1), deviceId: z.string().min(1) }).strict(),
        },
      },
    },
  },
  responses: {
    201: {
      description: "Automation assigned to one device.",
      content: { "application/json": { schema: deviceAutomationSchema } },
    },
    409: {
      description: "Automation missing or already assigned.",
      content: { "application/json": { schema: z.object({ error: z.string() }) } },
    },
  },
});
const runsRoute = createRoute({
  method: "get",
  path: `${base}/runs`,
  tags: ["Extensions"],
  request: { params },
  responses: {
    200: {
      description: "Local occurrence history. This history does not sync.",
      content: { "application/json": { schema: z.array(automationRunSchema) } },
    },
  },
});

export const createDeviceAutomationRoutes = (deps: ExtensionsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.openapi(listRoute, async (c) =>
    c.json(await listDeviceAutomations(deps, c.req.valid("param").projectId), 200),
  );
  routes.openapi(assignRoute, async (c) => {
    try {
      return c.json(await assignDeviceAutomation(deps, c.req.valid("param").projectId, c.req.valid("json")), 201);
    } catch (error) {
      if (
        error instanceof Error &&
        ["Automation not found.", "This automation is already assigned to a device."].includes(error.message)
      )
        return c.json({ error: error.message }, 409);
      throw error;
    }
  });
  routes.openapi(runsRoute, async (c) => {
    const storage = await openAutomationRuns(deps, c.req.valid("param").projectId);
    return c.json(
      (await storage.records.list("run:")).map((record) => automationRunSchema.parse(record.value)),
      200,
    );
  });
  return routes;
};
