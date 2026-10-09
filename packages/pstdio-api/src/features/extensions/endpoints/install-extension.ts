import { createRoute, z } from "@hono/zod-openapi";
import {
  installExtensionRequestSchema,
  installExtensionResponseSchema,
  uploadExtensionRequestSchema,
} from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import { extensionInstallFailure } from "../extension-install-failure";
import type { ProjectExtensionLifecycleRouteDeps } from "../project-extension-lifecycle";

const errorSchema = z.object({ error: z.string(), code: z.string().optional(), source: z.unknown().optional() });
export const installExtensionRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/install",
  tags: ["Extensions"],
  description: "Install a catalog extension or uploaded folder on this host, enable it and provision workspaces.",
  request: {
    params: z.object({ projectId: z.string() }).strict(),
    body: {
      required: false,
      content: {
        "application/json": { schema: installExtensionRequestSchema },
        "multipart/form-data": { schema: uploadExtensionRequestSchema },
      },
    },
  },
  responses: {
    201: {
      description: "Installed and enabled.",
      content: { "application/json": { schema: installExtensionResponseSchema } },
    },
    400: { description: "Invalid upload.", content: { "application/json": { schema: errorSchema } } },
    404: {
      description: "Project or catalog entry not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "Install conflict or missing project folder.",
      content: { "application/json": { schema: errorSchema } },
    },
    422: { description: "Extension validation failed.", content: { "application/json": { schema: errorSchema } } },
  },
});
export const installExtensionHandler =
  (deps: ProjectExtensionLifecycleRouteDeps): AppRouteHandler<typeof installExtensionRoute> =>
  async (c) => {
    const { projectId } = c.req.valid("param");
    const contentType = c.req.header("content-type") ?? "";
    if (!contentType.startsWith("multipart/form-data") && !contentType.startsWith("application/json"))
      return c.json({ error: "Send a catalog request as JSON or an uploaded folder as multipart form data." }, 400);
    const input = c.req.header("content-type")?.startsWith("multipart/form-data")
      ? c.req.valid("form")
      : c.req.valid("json");
    try {
      return c.json(await deps.projectExtensionLifecycle.install(projectId, input), 201);
    } catch (error) {
      const failure = await extensionInstallFailure(error);
      if (failure) return c.json(failure.body, failure.status);
      throw error;
    }
  };
