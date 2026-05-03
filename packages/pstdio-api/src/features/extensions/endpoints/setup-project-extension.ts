import { createRoute } from "@hono/zod-openapi";
import type { SetupProjectExtensionResponse } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import {
  extensionNotFoundResponseSchema,
  setupProjectExtensionOpenApiResponseSchema,
  setupProjectExtensionParamsSchema,
} from "../dto";
import { setupProjectExtension } from "../project-extension-setup";

export const setupProjectExtensionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/{installName}/setup",
  description: "Enable an installed extension for a project and install extension skills to selected agents.",
  tags: ["Extensions"],
  request: {
    params: setupProjectExtensionParamsSchema,
  },
  responses: {
    200: {
      description: "Extension enabled for the project.",
      content: { "application/json": { schema: setupProjectExtensionOpenApiResponseSchema } },
    },
    404: {
      description: "Project or extension not found.",
      content: { "application/json": { schema: extensionNotFoundResponseSchema } },
    },
  },
});

export const setupProjectExtensionHandler = (deps: RouteDeps): AppRouteHandler<typeof setupProjectExtensionRoute> => {
  return async (c) => {
    const { projectId, installName } = c.req.valid("param");
    const result = await setupProjectExtension(deps, { projectId, installName });

    if ("error" in result) {
      const error = result.error === "project_not_found" ? "Project not found" : "Extension not found";
      return c.json({ error }, 404);
    }

    const response: SetupProjectExtensionResponse = {
      extensionId: result.extension.id,
      namespace: result.extension.namespace,
      installName,
      installedSkills: result.installedSkills,
    };
    return c.json(response, 200);
  };
};
