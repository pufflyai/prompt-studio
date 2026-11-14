import { OpenAPIHono } from "@hono/zod-openapi";
import {
  publishResourceActivitySchema,
  resourceActivityQuerySchema,
  resourceLinkRefSchema,
} from "pstdio-api-contracts";
import { z } from "zod";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps } from "../extensions/deps";
import { createResourceActivityApi } from "./resource-activity-api";

const reference = z.object({ resource: resourceLinkRefSchema });
const entry = reference.extend({ id: z.string().min(1) });
const operations = (api: ReturnType<typeof createResourceActivityApi>) => ({
  capabilities: (raw: unknown) => api.capabilities(reference.parse(raw).resource),
  query: (raw: unknown) => api.query(resourceActivityQuerySchema.parse(raw)),
  get: (raw: unknown) => {
    const body = entry.parse(raw);
    return api.get(body.resource, body.id);
  },
  publish: (raw: unknown) => {
    const body = reference.extend({ entry: publishResourceActivitySchema }).parse(raw);
    return api.publish(body.resource, body.entry);
  },
  resolve: (raw: unknown) => {
    const body = entry.extend({ resolved: z.boolean() }).parse(raw);
    return api.resolve(body.resource, body.id, body.resolved);
  },
  handoff: (raw: unknown) => {
    const body = entry.extend({ workspaceId: z.string().optional() }).parse(raw);
    return api.handoff(body.resource, body.id, { workspaceId: body.workspaceId });
  },
  attach: (raw: unknown) => {
    const body = reference
      .extend({ key: z.string().optional(), name: z.string(), mimeType: z.string(), base64: z.string() })
      .parse(raw);
    return api.attach(body.resource, {
      key: body.key,
      name: body.name,
      mimeType: body.mimeType,
      data: Buffer.from(body.base64, "base64"),
    });
  },
  attachment: async (raw: unknown) => {
    const body = entry.parse(raw);
    const file = await api.readAttachment(body.resource, body.id);
    return { attachment: file.attachment, base64: Buffer.from(file.data).toString("base64") };
  },
});
export const createResourceActivityRoutes = (deps: ExtensionsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.post("/projects/:projectId/activity/:operation", async (c) => {
    try {
      const raw = await c.req.json();
      const handlers = operations(
        createResourceActivityApi(deps, {
          projectId: c.req.param("projectId"),
          sessionId: typeof raw.sourceSessionId === "string" ? raw.sourceSessionId : undefined,
        }),
      );
      const operation = c.req.param("operation");
      if (!Object.hasOwn(handlers, operation)) return c.json({ error: "Unknown Activity operation." }, 404);
      return c.json(await handlers[operation as keyof typeof handlers](raw));
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  });
  return routes;
};
