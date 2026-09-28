import { createRoute, z } from "@hono/zod-openapi";
import { addLocalExtensionFolderRequestSchema, addLocalExtensionFolderResponseSchema } from "pstdio-api-contracts";
import { ExtensionNameConflictError, ProjectNotFoundError } from "../../../services/extension-service";
import type { AppRouteHandler } from "../../../types";
import { ExtensionAlreadyInstalledError, ExtensionValidationFailedError } from "../install-extension-source";
import { InvalidExtensionFolderError } from "../local-extension-folder";
import type { ProjectExtensionLifecycleRouteDeps } from "../project-extension-lifecycle";

const errorSchema = z.object({ error: z.string() });

export const addLocalExtensionFolderRoute = createRoute({
  method: "post",
  path: "/projects/{projectId}/extensions/local",
  description:
    "Copy an extension folder into the project's .pstdio/extensions folder and load it. Each `files` part is one file of the folder; its file name is the path relative to the folder root.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string().openapi({ description: "Project ID" }) }).strict(),
    body: {
      required: true,
      content: {
        "multipart/form-data": {
          schema: addLocalExtensionFolderRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Extension folder copied and loaded.",
      content: { "application/json": { schema: addLocalExtensionFolderResponseSchema } },
    },
    400: {
      description:
        "The folder has no package.json, a path leaves the folder, the extension fails validation, or the project has no local folder.",
      content: { "application/json": { schema: errorSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    409: {
      description: "An extension folder with this name already exists, or its name conflicts with another extension.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const addLocalExtensionFolderHandler = (
  deps: ProjectExtensionLifecycleRouteDeps,
): AppRouteHandler<typeof addLocalExtensionFolderRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const folder = c.req.valid("form");
    try {
      return c.json(await deps.projectExtensionLifecycle.addLocalFolder(projectId, folder), 200);
    } catch (error) {
      if (error instanceof InvalidExtensionFolderError) return c.json({ error: error.message }, 400);
      if (error instanceof ExtensionValidationFailedError) {
        return c.json({ error: error.firstError ?? error.message }, 400);
      }
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      if (error instanceof ExtensionAlreadyInstalledError || error instanceof ExtensionNameConflictError) {
        return c.json({ error: error.message }, 409);
      }
      throw error;
    }
  };
};
