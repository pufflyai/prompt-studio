import { createRoute, z } from "@hono/zod-openapi";
import {
  extensionProcessEnvironmentPermissionSchema,
  grantExtensionProcessEnvironmentSchema,
} from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { ProcessEnvironmentPermissionError } from "../process-environment/permissions";

const params = z.object({ projectId: z.string(), extensionId: z.string() }).strict();
const errorSchema = z.object({ code: z.string(), error: z.string() });
const path = "/projects/{projectId}/extension-process-environment/{extensionId}";
const permissionResponse = {
  description: "Requested and granted host environment names for the extension's current source. Never values.",
  content: { "application/json": { schema: extensionProcessEnvironmentPermissionSchema } },
};
const notFound = {
  description: "The project has no such extension.",
  content: { "application/json": { schema: errorSchema } },
};

export const getExtensionProcessEnvironmentRoute = createRoute({
  method: "get",
  path,
  tags: ["Extensions"],
  request: { params },
  responses: { 200: permissionResponse, 404: notFound },
});

export const grantExtensionProcessEnvironmentRoute = createRoute({
  method: "put",
  path,
  tags: ["Extensions"],
  description:
    "Allow the selected requested names for this project and the observed extension source. Replaces the previous grant.",
  request: {
    params,
    body: { content: { "application/json": { schema: grantExtensionProcessEnvironmentSchema } } },
  },
  responses: {
    200: permissionResponse,
    400: {
      description: "A name is not requested by the source.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: notFound,
    409: {
      description: "The source changed after the person saw its requested names.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const revokeExtensionProcessEnvironmentRoute = createRoute({
  method: "delete",
  path,
  tags: ["Extensions"],
  description: "Stop the children that received granted values, then remove the grant.",
  request: { params },
  responses: { 204: { description: "Grant removed." } },
});

const STATUS = {
  extension_not_found: 404,
  process_environment_not_requested: 400,
  process_environment_source_changed: 409,
  process_environment_not_granted: 400,
} as const;

const permissionError = (error: unknown) => {
  if (!(error instanceof ProcessEnvironmentPermissionError)) throw error;
  return { body: { code: error.code, error: error.message }, status: STATUS[error.code] };
};

export const getExtensionProcessEnvironmentHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof getExtensionProcessEnvironmentRoute> =>
  async (c) => {
    const { projectId, extensionId } = c.req.valid("param");
    try {
      return c.json(await deps.extensionProcessEnvironment.read(projectId, extensionId), 200);
    } catch (error) {
      const { body } = permissionError(error);
      return c.json(body, 404);
    }
  };

export const grantExtensionProcessEnvironmentHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof grantExtensionProcessEnvironmentRoute> =>
  async (c) => {
    const { projectId, extensionId } = c.req.valid("param");
    try {
      return c.json(await deps.extensionProcessEnvironment.grant(projectId, extensionId, c.req.valid("json")), 200);
    } catch (error) {
      const { body, status } = permissionError(error);
      if (status === 409) return c.json(body, 409);
      if (status === 404) return c.json(body, 404);
      return c.json(body, 400);
    }
  };

export const revokeExtensionProcessEnvironmentHandler =
  (deps: ExtensionsRouteDeps): AppRouteHandler<typeof revokeExtensionProcessEnvironmentRoute> =>
  async (c) => {
    const { projectId, extensionId } = c.req.valid("param");
    await deps.extensionProcessEnvironment.revoke(projectId, extensionId);
    return c.body(null, 204);
  };
