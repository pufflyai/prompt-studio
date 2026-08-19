import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import { listExtensionAppearanceResponseSchema } from "pstdio-api-contracts";
import type { ExtensionRuntime } from "pstdio-extensions";
import { ProjectNotFoundError } from "../../../services/extension-service";
import type { AppBindings, AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";

const errorSchema = z.object({ error: z.string() });

const toThemeRecord = (theme: ExtensionRuntime["themes"][number]) => ({
  id: theme.id,
  extensionId: theme.extensionId,
  title: theme.title,
  description: theme.description,
  format: theme.format,
  mode: theme.mode,
  source: theme.source,
  tokens: theme.preference.tokens,
  monacoTheme: theme.monacoTheme,
});

const toFileIconThemeRecord = (theme: ExtensionRuntime["fileIconThemes"][number]) => ({
  id: theme.id,
  extensionId: theme.extensionId,
  title: theme.title,
  description: theme.description,
  format: theme.format,
  source: theme.source,
  definitions: theme.definitions,
  fileExtensions: theme.fileExtensions,
  fileNames: theme.fileNames,
  defaults: theme.defaults,
  fonts: theme.fonts,
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

export const listExtensionAppearanceHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof listExtensionAppearanceRoute> => {
  const handler = async (c: Context<AppBindings>) => {
    const { projectId } = c.req.param();

    try {
      const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
      return c.json(
        {
          themes: snapshot.runtime.themes.map(toThemeRecord),
          fileIconThemes: snapshot.runtime.fileIconThemes.map(toFileIconThemeRecord),
          translations: snapshot.runtime.translations,
          diagnostics: snapshot.runtime.diagnostics,
        },
        200,
      );
    } catch (error) {
      if (error instanceof ProjectNotFoundError) return c.json({ error: error.message }, 404);
      throw error;
    }
  };

  return handler as AppRouteHandler<typeof listExtensionAppearanceRoute>;
};
