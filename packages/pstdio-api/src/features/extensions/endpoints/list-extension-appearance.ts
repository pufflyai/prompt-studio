import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { listExtensionAppearanceResponseSchema } from "pstdio-api-contracts";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppBindings } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { loadProjectExtensionRuntime } from "../extension-command-runtime";

const errorSchema = z.object({ error: z.string() });

const toThemeRecord = (
  theme: Awaited<ReturnType<typeof loadProjectExtensionRuntime>>["runtime"]["themes"][number],
) => ({
  id: theme.id,
  extensionId: theme.extensionId,
  namespace: theme.namespace,
  title: theme.title,
  description: theme.description,
  format: theme.format,
  mode: theme.mode,
  source: theme.source,
  tokens: theme.preference.tokens,
  monacoTheme: theme.monacoTheme,
});

const toFileIconThemeRecord = (
  theme: Awaited<ReturnType<typeof loadProjectExtensionRuntime>>["runtime"]["fileIconThemes"][number],
) => ({
  id: theme.id,
  extensionId: theme.extensionId,
  namespace: theme.namespace,
  title: theme.title,
  description: theme.description,
  format: theme.format,
  source: theme.source,
  definitions: theme.definitions,
  fileExtensions: theme.fileExtensions,
  fileNames: theme.fileNames,
});

export const listExtensionAppearanceRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/appearance",
  description: "List appearance metadata for enabled project extensions.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string().openapi({ description: "Project ID" }) }).strict(),
  },
  responses: {
    200: {
      description: "Enabled extension appearance contributions.",
      content: { "application/json": { schema: listExtensionAppearanceResponseSchema } },
    },
    404: {
      description: "Project not found.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const listExtensionAppearanceHandler = (deps: ExtensionsRouteDeps) => {
  return async (c: Context<AppBindings>) => {
    const { projectId } = c.req.param();

    try {
      const { runtime } = await loadProjectExtensionRuntime(deps, projectId);
      return c.json(
        {
          themes: runtime.themes.map(toThemeRecord),
          fileIconThemes: runtime.fileIconThemes.map(toFileIconThemeRecord),
          diagnostics: runtime.diagnostics,
        },
        200,
      );
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };
};
