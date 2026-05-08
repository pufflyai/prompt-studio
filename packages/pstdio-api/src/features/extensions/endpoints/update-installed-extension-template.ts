import { createRoute, z } from "@hono/zod-openapi";
import {
  updateInstalledExtensionTemplateInputSchema,
  updateInstalledExtensionTemplateResponseSchema,
} from "pstdio-api-contracts";
import {
  ExtensionCatalogAssetError,
  isPackageAssetDescriptor,
  isRecord,
  sourceRootForAsset,
  writeTextPackageAsset,
} from "../../../services/extension-asset-catalog";
import type { AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { loadExtensionSource } from "../extension-runtime";

const errorSchema = z.object({ error: z.string() });

export const updateInstalledExtensionTemplateRoute = createRoute({
  method: "put",
  path: "/extensions/installed/{installName}/templates/{templateKey}",
  description: "Update a template source asset for an installed extension.",
  tags: ["Extensions"],
  request: {
    params: z
      .object({
        installName: z.string().openapi({ description: "Installed extension folder name" }),
        templateKey: z.string().openapi({ description: "Extension template contribution key" }),
      })
      .strict(),
    body: {
      content: { "application/json": { schema: updateInstalledExtensionTemplateInputSchema.strict() } },
    },
  },
  responses: {
    200: {
      description: "Installed extension template asset updated.",
      content: { "application/json": { schema: updateInstalledExtensionTemplateResponseSchema } },
    },
    404: {
      description: "Installed extension template not found.",
      content: { "application/json": { schema: errorSchema } },
    },
    400: {
      description: "Invalid installed extension template update request.",
      content: { "application/json": { schema: errorSchema } },
    },
  },
});

export const updateInstalledExtensionTemplateHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof updateInstalledExtensionTemplateRoute> => {
  return async (c) => {
    const { installName, templateKey } = c.req.valid("param");
    const body = c.req.valid("json");
    const installedSource = await deps.extensionService.getInstalledSource(installName);

    if (!installedSource) {
      return c.json({ error: `Installed extension not found: ${installName}` }, 404);
    }

    const loaded = await loadExtensionSource(installedSource.source_path);
    const contribution = isRecord(loaded.definition.templates) ? loaded.definition.templates[templateKey] : null;

    if (!isRecord(contribution) || !isPackageAssetDescriptor(contribution.source)) {
      return c.json({ error: `Installed extension template not found: ${templateKey}` }, 404);
    }

    try {
      writeTextPackageAsset(sourceRootForAsset(installedSource.source_path), contribution.source, body.content);
    } catch (error) {
      if (error instanceof ExtensionCatalogAssetError) {
        return c.json({ error: error.message }, 400);
      }
      throw error;
    }

    return c.json({ installName, key: templateKey, content: body.content }, 200);
  };
};
