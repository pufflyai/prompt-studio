import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import type { AppBindings, AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { openPublishedCatalog, publicationSchema, publishExtension } from "./catalog";
import { adoptPublishedExtension, changePublishedCatalog } from "./change-catalog";

const params = z.strictObject({ projectId: z.string() });
const body = z.discriminatedUnion("kind", [
  z.strictObject({ kind: z.literal("publish"), instanceId: z.string(), expectedRevision: z.string() }),
  z.strictObject({
    kind: z.literal("rollback"),
    extensionId: z.string(),
    revision: z.string(),
    expectedRevision: z.string(),
  }),
  z.strictObject({
    kind: z.literal("enabled"),
    extensionId: z.string(),
    enabled: z.boolean(),
    expectedRevision: z.string(),
  }),
  z.strictObject({ kind: z.literal("adopt"), extensionId: z.string() }),
]);
const responses = {
  200: {
    description: "Publication state or locally saved outcome.",
    content: { "application/json": { schema: z.unknown() } },
  },
  404: {
    description: "Project not found.",
    content: { "application/json": { schema: z.object({ error: z.string() }) } },
  },
  409: {
    description: "Publication could not be changed.",
    content: { "application/json": { schema: z.object({ error: z.string() }) } },
  },
};
const path = "/projects/{projectId}/extension-publications";
const getRoute = createRoute({ method: "get", path, tags: ["Extensions"], request: { params }, responses });
const postRoute = createRoute({
  method: "post",
  path,
  tags: ["Extensions"],
  request: { params, body: { content: { "application/json": { schema: body } } } },
  responses,
});
export const publicationRoutes = (deps: ExtensionsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  const get: AppRouteHandler<typeof getRoute> = async (c) => {
    const { projectId } = c.req.valid("param");
    if (!(await deps.projectService.get(projectId))) return c.json({ error: "Project not found" }, 404);
    const catalog = await openPublishedCatalog(deps, projectId);
    const ids = new Set(
      (await catalog.list())
        .filter((record) => !record.recordId.startsWith("package:"))
        .map((record) => record.recordId),
    );
    for (const { installedSource } of await deps.extensionService.listProjectExtensionInstances(projectId))
      ids.add(installedSource.extension_id);
    const records = await Promise.all(
      [...ids].sort().map(async (id) => {
        const record = await catalog.read(id);
        return {
          recordId: id,
          revision: record.revision,
          exists: record.exists,
          deleted: record.deleted,
          value: record.deleted || record.value === null ? null : publicationSchema.parse(record.value),
          asset: record.asset,
        };
      }),
    );
    return c.json(records, 200);
  };
  const post: AppRouteHandler<typeof postRoute> = async (c) => {
    const { projectId } = c.req.valid("param");
    if (!(await deps.projectService.get(projectId))) return c.json({ error: "Project not found" }, 404);
    const input = c.req.valid("json");
    try {
      if (input.kind === "publish") return c.json(await publishExtension(deps, { ...input, projectId }), 200);
      if (input.kind === "adopt")
        return c.json(await adoptPublishedExtension(deps, projectId, input.extensionId, c.req.raw.signal), 200);
      return c.json(await changePublishedCatalog(deps, projectId, input, c.req.raw.signal), 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : "Publication failed" }, 409);
    }
  };
  routes.openapi(getRoute, get);
  routes.openapi(postRoute, post);
  return routes;
};
