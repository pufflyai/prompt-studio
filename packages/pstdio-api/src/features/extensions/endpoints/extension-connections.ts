import { createRoute, z } from "@hono/zod-openapi";
import {
  configureExtensionConnectionSchema,
  extensionConnectionRecordSchema,
  listExtensionConnectionsResponseSchema,
} from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { ConnectionRemovalInputError } from "../extension-connection-transport";

const connectionParams = z
  .object({ projectId: z.string(), extensionId: z.string(), connectionId: z.string() })
  .strict();
const errorSchema = z.object({ error: z.string() });

export const listExtensionConnectionsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extension-connections",
  tags: ["Extensions"],
  request: { params: z.object({ projectId: z.string() }).strict() },
  responses: {
    200: {
      description: "Configured extension connections.",
      content: { "application/json": { schema: listExtensionConnectionsResponseSchema } },
    },
  },
});

export const configureExtensionConnectionRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/extension-connections/{extensionId}/{connectionId}",
  tags: ["Extensions"],
  request: {
    params: connectionParams,
    body: { content: { "application/json": { schema: configureExtensionConnectionSchema } } },
  },
  responses: {
    200: {
      description: "Configured extension connection.",
      content: { "application/json": { schema: extensionConnectionRecordSchema } },
    },
    400: { description: "Invalid connection configuration.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const deleteExtensionConnectionRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/extension-connections/{extensionId}/{connectionId}",
  tags: ["Extensions"],
  request: {
    params: connectionParams,
    query: z
      .object({
        credentialScope: z.enum(["all-projects", "project"]).optional(),
        origin: z.url().optional().openapi({
          description: "Server origin for all-projects revocation, including after project configuration is removed.",
        }),
      })
      .strict(),
  },
  responses: {
    204: { description: "Revoked the requested connection or shared sign-in, or it was already absent." },
    400: { description: "Invalid or ambiguous revocation.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const checkExtensionConnectionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extension-connections/{extensionId}/{connectionId}/check",
  tags: ["Extensions"],
  request: { params: connectionParams },
  responses: {
    200: {
      description: "Checked extension connection.",
      content: { "application/json": { schema: extensionConnectionRecordSchema } },
    },
    400: { description: "Connection check is unavailable.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const listExtensionConnectionsHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof listExtensionConnectionsRoute> =>
  async (c) => {
    const { projectId } = c.req.valid("param");
    return c.json({ connections: await deps.extensionConnectionService.list(projectId) }, 200);
  };

export const configureExtensionConnectionHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof configureExtensionConnectionRoute> =>
  async (c) => {
    const params = c.req.valid("param");
    try {
      const configured = await deps.extensionConnectionService.configure({ ...params, ...c.req.valid("json") });
      return c.json(configured, 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  };

export const deleteExtensionConnectionHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof deleteExtensionConnectionRoute> =>
  async (c) => {
    try {
      await deps.extensionConnectionService.remove({ ...c.req.valid("param"), ...c.req.valid("query") });
      return c.body(null, 204);
    } catch (error) {
      if (!(error instanceof ConnectionRemovalInputError)) throw error;
      return c.json({ error: error.message }, 400);
    }
  };

export const checkExtensionConnectionHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof checkExtensionConnectionRoute> =>
  async (c) => {
    try {
      return c.json(await deps.extensionConnectionService.check(c.req.valid("param")), 200);
    } catch (error) {
      return c.json({ error: error instanceof Error ? error.message : String(error) }, 400);
    }
  };
