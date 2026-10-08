import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  addResourceAnchorsSchema,
  removeResourceAnchorsSchema,
  resourceAnchorPageSchema,
  resourceAnchorQuerySchema,
} from "pstdio-api-contracts";
import type { AppBindings } from "../../types";
import { createResourceLinksApi } from "../extensions/command-environment/resource-links";
import type { ExtensionsRouteDeps } from "../extensions/deps";

const params = z.object({ projectId: z.string() });
const error = z.object({ error: z.string() });
const responses = { 400: { description: "Invalid anchor change", content: { "application/json": { schema: error } } } };
const add = createRoute({
  method: "post",
  path: "/projects/{projectId}/resource-anchors/add",
  tags: ["Resources"],
  request: { params, body: { content: { "application/json": { schema: addResourceAnchorsSchema } } } },
  responses: {
    200: { description: "Anchors added", content: { "application/json": { schema: z.object({}) } } },
    ...responses,
  },
});
const remove = createRoute({
  method: "post",
  path: "/projects/{projectId}/resource-anchors/remove",
  tags: ["Resources"],
  request: { params, body: { content: { "application/json": { schema: removeResourceAnchorsSchema } } } },
  responses: {
    200: { description: "Anchors removed", content: { "application/json": { schema: z.object({}) } } },
    ...responses,
  },
});
const query = createRoute({
  method: "post",
  path: "/projects/{projectId}/resource-anchors/query",
  tags: ["Resources"],
  request: { params, body: { content: { "application/json": { schema: resourceAnchorQuerySchema } } } },
  responses: {
    200: { description: "Resource anchors", content: { "application/json": { schema: resourceAnchorPageSchema } } },
    ...responses,
  },
});

export const createResourceAnchorRoutes = (deps: ExtensionsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.openapi(add, async (c) => {
    const body = c.req.valid("json");
    try {
      await createResourceLinksApi(deps, c.req.valid("param")).addAnchors(body.resource, body.anchors);
      return c.json({}, 200);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });
  routes.openapi(remove, async (c) => {
    const body = c.req.valid("json");
    try {
      await createResourceLinksApi(deps, c.req.valid("param")).removeAnchors(body.resource, body.refs);
      return c.json({}, 200);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });
  routes.openapi(query, async (c) => {
    try {
      const result = await createResourceLinksApi(deps, c.req.valid("param")).listAnchors(c.req.valid("json"));
      return c.json(result, 200);
    } catch (err) {
      return c.json({ error: err instanceof Error ? err.message : String(err) }, 400);
    }
  });
  return routes;
};
