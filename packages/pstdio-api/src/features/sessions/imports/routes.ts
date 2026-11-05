import { createRoute, OpenAPIHono, z } from "@hono/zod-openapi";
import {
  sessionImportErrorsSchema,
  sessionImportJobSchema,
  sessionImportPreviewSchema,
  sessionImportSourceSchema,
} from "pstdio-api-contracts";
import type { AppBindings } from "../../../types";
import type { createSessionImportService } from "./service";
import { SessionImportError } from "./source";

const content = <T extends z.ZodType>(schema: T) => ({ "application/json": { schema } });
const failures = {
  400: { description: "Invalid source or mapping.", content: content(z.object({ error: z.string() })) },
  404: { description: "Import not found.", content: content(z.object({ error: z.string() })) },
  409: { description: "Import cannot run in its current state.", content: content(z.object({ error: z.string() })) },
};
const id = z.object({ id: z.string().uuid() });
const body = { required: true, content: content(sessionImportSourceSchema) };
const tags = ["Session imports"];
export const createSessionImportRoutes = (service: ReturnType<typeof createSessionImportService>) => {
  const routes = new OpenAPIHono<AppBindings>();
  routes.onError((error, c) => {
    if (error instanceof SessionImportError) return c.json({ error: error.message }, error.status);
    throw error;
  });
  routes.openapi(
    createRoute({
      method: "post",
      path: "/session-imports/preview",
      tags,
      description:
        "Inspect an exported backup on the API host without changing live data. Error samples are limited to 100 rows.",
      request: { body },
      responses: {
        200: { description: "Backup inspected.", content: content(sessionImportPreviewSchema) },
        ...failures,
      },
    }),
    async (c) => c.json(await service.preview(c.req.valid("json"), c.req.raw.signal), 200),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/session-imports",
      tags,
      description:
        "Start a durable import of selected source projects into existing local projects. Source paths belong to the API host.",
      request: { body },
      responses: { 202: { description: "Import started.", content: content(sessionImportJobSchema) }, ...failures },
    }),
    async (c) => c.json(await service.start(c.req.valid("json")), 202),
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: "/session-imports/{id}",
      tags,
      request: { params: id },
      responses: {
        200: { description: "Durable import progress.", content: content(sessionImportJobSchema) },
        ...failures,
      },
    }),
    async (c) => c.json(await service.get(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/session-imports/{id}/pause",
      tags,
      request: { params: id },
      responses: {
        200: { description: "Import paused after its current session.", content: content(sessionImportJobSchema) },
        ...failures,
      },
    }),
    async (c) => c.json(await service.pause(c.req.valid("param").id), 200),
  );
  routes.openapi(
    createRoute({
      method: "post",
      path: "/session-imports/{id}/resume",
      tags,
      request: { params: id },
      description:
        "Continue a checkpointed import. A completed pass with errors starts another pass and skips existing sessions.",
      responses: { 202: { description: "Import resumed.", content: content(sessionImportJobSchema) }, ...failures },
    }),
    async (c) => c.json(await service.resume(c.req.valid("param").id), 202),
  );
  routes.openapi(
    createRoute({
      method: "get",
      path: "/session-imports/{id}/errors",
      tags,
      request: {
        params: id,
        query: z.object({
          offset: z.coerce.number().int().nonnegative().default(0),
          limit: z.coerce.number().int().min(1).max(100).default(100),
        }),
      },
      responses: {
        200: { description: "A page of per-session failures.", content: content(sessionImportErrorsSchema) },
        ...failures,
      },
    }),
    async (c) => {
      const query = c.req.valid("query");
      return c.json(await service.errors(c.req.valid("param").id, query.offset, query.limit), 200);
    },
  );
  return routes;
};
