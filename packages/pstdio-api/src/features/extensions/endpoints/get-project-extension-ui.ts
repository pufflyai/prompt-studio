import { createRoute, z } from "@hono/zod-openapi";
import { dashboardExtensionMetadataSchema } from "pstdio-api-contracts";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { checkExtensionSource } from "../extension-runtime";

export const getProjectExtensionUiRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/ui",
  description: "Get enabled extension UI metadata for a project.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Enabled extension UI metadata.",
      content: { "application/json": { schema: dashboardExtensionMetadataSchema } },
    },
  },
});

export const getProjectExtensionUiHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof getProjectExtensionUiRoute> => {
  return async (c) => {
    const { projectId } = c.req.valid("param");
    const sources = await deps.extensionService.listEnabledProjectExtensionSources(projectId);
    const checks = await Promise.all(sources.map((source) => checkExtensionSource(source.source_path, "")));

    return c.json(
      {
        extensions: checks.flatMap(({ check }) => check.extensions),
        commands: checks.flatMap(({ check }) => check.commands),
        menuContributions: checks.flatMap(({ check }) => check.menuContributions),
        views: checks.flatMap(({ check }) => check.views),
        routes: checks.flatMap(({ check }) => check.routes),
        navigation: checks.flatMap(({ check }) => check.navigation),
        settingsPanels: checks.flatMap(({ check }) => check.settingsPanels),
        diagnostics: checks.flatMap(({ check }) => check.diagnostics),
      },
      200,
    );
  };
};
