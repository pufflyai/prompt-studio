import { createRoute, z } from "@hono/zod-openapi";
import type { Context } from "hono";
import {
  type ExtensionSettingDefinitionRecord,
  listExtensionSettingsResponseSchema,
  updateExtensionSettingRequestSchema,
} from "pstdio-api-contracts";
import type { ExtensionRuntime } from "pstdio-extensions";
import type { AppBindings, AppRouteHandler } from "../../../types";
import type { ExtensionsRouteDeps } from "../deps";
import { ExtensionSettingError, type ExtensionSettingsContext } from "../extension-settings-service";

const errorSchema = z.object({ error: z.string(), code: z.string().optional() });

const settingKeyParam = z.string().openapi({ description: "Extension setting key" });

const toDefinition = (setting: ExtensionRuntime["settings"][number]): ExtensionSettingDefinitionRecord => ({
  key: setting.key,
  extensionId: setting.extensionId,
  type: setting.contribution.type,
  scope: setting.contribution.scope,
  default: setting.contribution.default,
  enum: setting.contribution.enum,
  title: setting.contribution.title,
  description: setting.contribution.description,
});

const settingsContextForRuntime = (
  runtime: ExtensionRuntime,
  input: {
    extensionId: string;
    extensionInstanceId: string;
    installedExtensionId: string;
  },
): ExtensionSettingsContext => ({
  ...input,
  definitions: runtime.settings.map(toDefinition),
});

const settingErrorResponse = (c: Context<AppBindings>, error: ExtensionSettingError) =>
  c.json({ error: error.message, code: error.code }, 400);

export const listProjectExtensionSettingsRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{instanceId}/settings",
  description: "List effective declared settings for a project extension instance.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string(), instanceId: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Effective extension settings.",
      content: { "application/json": { schema: listExtensionSettingsResponseSchema } },
    },
    404: { description: "Extension instance not found.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const getProjectExtensionSettingRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{instanceId}/settings/{key}",
  description: "Get an effective declared setting for a project extension instance.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string(), instanceId: z.string(), key: settingKeyParam }).strict(),
  },
  responses: {
    200: {
      description: "Effective extension setting.",
      content: { "application/json": { schema: listExtensionSettingsResponseSchema.shape.settings.element } },
    },
    400: { description: "Invalid setting key.", content: { "application/json": { schema: errorSchema } } },
    404: { description: "Extension instance not found.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const updateProjectExtensionSettingRoute = createRoute({
  method: "put",
  path: "/projects/{projectId}/extensions/{instanceId}/settings/{key}",
  description: "Update a declared setting for a project extension instance.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string(), instanceId: z.string(), key: settingKeyParam }).strict(),
    body: { content: { "application/json": { schema: updateExtensionSettingRequestSchema } } },
  },
  responses: {
    200: {
      description: "Updated extension setting.",
      content: { "application/json": { schema: listExtensionSettingsResponseSchema.shape.settings.element } },
    },
    400: { description: "Invalid setting value.", content: { "application/json": { schema: errorSchema } } },
    404: { description: "Extension instance not found.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const deleteProjectExtensionSettingRoute = createRoute({
  method: "delete",
  path: "/projects/{projectId}/extensions/{instanceId}/settings/{key}",
  description: "Delete a declared setting override for a project extension instance.",
  tags: ["Extensions"],
  request: {
    params: z.object({ projectId: z.string(), instanceId: z.string(), key: settingKeyParam }).strict(),
  },
  responses: {
    204: { description: "Deleted setting override." },
    400: { description: "Invalid setting key.", content: { "application/json": { schema: errorSchema } } },
    404: { description: "Extension instance not found.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const listGlobalExtensionSettingsRoute = createRoute({
  method: "get",
  path: "/extensions/installed/{installName}/settings",
  description: "List effective global declared settings for an installed extension source.",
  tags: ["Extensions"],
  request: {
    params: z.object({ installName: z.string() }).strict(),
  },
  responses: {
    200: {
      description: "Effective global extension settings.",
      content: { "application/json": { schema: listExtensionSettingsResponseSchema } },
    },
    404: { description: "Installed extension not found.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const getGlobalExtensionSettingRoute = createRoute({
  method: "get",
  path: "/extensions/installed/{installName}/settings/{key}",
  description: "Get an effective global declared setting for an installed extension source.",
  tags: ["Extensions"],
  request: {
    params: z.object({ installName: z.string(), key: settingKeyParam }).strict(),
  },
  responses: {
    200: {
      description: "Effective extension setting.",
      content: { "application/json": { schema: listExtensionSettingsResponseSchema.shape.settings.element } },
    },
    400: { description: "Invalid setting key.", content: { "application/json": { schema: errorSchema } } },
    404: { description: "Installed extension not found.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const updateGlobalExtensionSettingRoute = createRoute({
  method: "put",
  path: "/extensions/installed/{installName}/settings/{key}",
  description: "Update a global declared setting for an installed extension source.",
  tags: ["Extensions"],
  request: {
    params: z.object({ installName: z.string(), key: settingKeyParam }).strict(),
    body: { content: { "application/json": { schema: updateExtensionSettingRequestSchema } } },
  },
  responses: {
    200: {
      description: "Updated extension setting.",
      content: { "application/json": { schema: listExtensionSettingsResponseSchema.shape.settings.element } },
    },
    400: { description: "Invalid setting value.", content: { "application/json": { schema: errorSchema } } },
    404: { description: "Installed extension not found.", content: { "application/json": { schema: errorSchema } } },
  },
});

export const deleteGlobalExtensionSettingRoute = createRoute({
  method: "delete",
  path: "/extensions/installed/{installName}/settings/{key}",
  description: "Delete a global declared setting override for an installed extension source.",
  tags: ["Extensions"],
  request: {
    params: z.object({ installName: z.string(), key: settingKeyParam }).strict(),
  },
  responses: {
    204: { description: "Deleted setting override." },
    400: { description: "Invalid setting key.", content: { "application/json": { schema: errorSchema } } },
    404: { description: "Installed extension not found.", content: { "application/json": { schema: errorSchema } } },
  },
});

const resolveProjectSettingsContext = async (deps: ExtensionsRouteDeps, projectId: string, instanceId: string) => {
  const record = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
  if (!record) return null;
  const snapshot = await deps.extensionRuntimeCatalog.get(projectId);
  return settingsContextForRuntime(snapshot.runtime, {
    extensionId: record.installedSource.extension_id,
    extensionInstanceId: record.instance.id,
    installedExtensionId: record.installedSource.id,
  });
};

const resolveGlobalSettingsContext = async (deps: ExtensionsRouteDeps, installName: string) => {
  const installedSource = await deps.extensionService.getInstalledSource(installName);
  if (!installedSource) return null;
  const runtime = await deps.extensionRuntimeCatalog.getInstalledSourceRuntime(installedSource);
  return settingsContextForRuntime(runtime, {
    extensionId: installedSource.extension_id,
    extensionInstanceId: "",
    installedExtensionId: installedSource.id,
  });
};

export const listProjectExtensionSettingsHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof listProjectExtensionSettingsRoute> => {
  return async (c) => {
    const { projectId, instanceId } = c.req.valid("param");
    const context = await resolveProjectSettingsContext(deps, projectId, instanceId);
    if (!context) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
    return c.json({ settings: await deps.extensionSettingsService.list(context) }, 200);
  };
};

export const getProjectExtensionSettingHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof getProjectExtensionSettingRoute> => {
  return async (c) => {
    const { projectId, instanceId, key } = c.req.valid("param");
    const context = await resolveProjectSettingsContext(deps, projectId, instanceId);
    if (!context) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
    try {
      return c.json(await deps.extensionSettingsService.get(context, key), 200);
    } catch (error) {
      if (error instanceof ExtensionSettingError) return settingErrorResponse(c, error);
      throw error;
    }
  };
};

export const updateProjectExtensionSettingHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof updateProjectExtensionSettingRoute> => {
  return async (c) => {
    const { projectId, instanceId, key } = c.req.valid("param");
    const body = c.req.valid("json");
    const context = await resolveProjectSettingsContext(deps, projectId, instanceId);
    if (!context) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
    try {
      return c.json(await deps.extensionSettingsService.set(context, key, body.value), 200);
    } catch (error) {
      if (error instanceof ExtensionSettingError) return settingErrorResponse(c, error);
      throw error;
    }
  };
};

export const deleteProjectExtensionSettingHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof deleteProjectExtensionSettingRoute> => {
  return async (c) => {
    const { projectId, instanceId, key } = c.req.valid("param");
    const context = await resolveProjectSettingsContext(deps, projectId, instanceId);
    if (!context) return c.json({ error: `Extension instance not found: ${instanceId}` }, 404);
    try {
      await deps.extensionSettingsService.delete(context, key);
      return c.body(null, 204);
    } catch (error) {
      if (error instanceof ExtensionSettingError) return settingErrorResponse(c, error);
      throw error;
    }
  };
};

export const listGlobalExtensionSettingsHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof listGlobalExtensionSettingsRoute> => {
  return async (c) => {
    const { installName } = c.req.valid("param");
    const context = await resolveGlobalSettingsContext(deps, installName);
    if (!context) return c.json({ error: `Installed extension not found: ${installName}` }, 404);
    return c.json({ settings: await deps.extensionSettingsService.list(context, "global") }, 200);
  };
};

export const getGlobalExtensionSettingHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof getGlobalExtensionSettingRoute> => {
  return async (c) => {
    const { installName, key } = c.req.valid("param");
    const context = await resolveGlobalSettingsContext(deps, installName);
    if (!context) return c.json({ error: `Installed extension not found: ${installName}` }, 404);
    try {
      return c.json(await deps.extensionSettingsService.get(context, key, "global"), 200);
    } catch (error) {
      if (error instanceof ExtensionSettingError) return settingErrorResponse(c, error);
      throw error;
    }
  };
};

export const updateGlobalExtensionSettingHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof updateGlobalExtensionSettingRoute> => {
  return async (c) => {
    const { installName, key } = c.req.valid("param");
    const body = c.req.valid("json");
    const context = await resolveGlobalSettingsContext(deps, installName);
    if (!context) return c.json({ error: `Installed extension not found: ${installName}` }, 404);
    try {
      return c.json(await deps.extensionSettingsService.set(context, key, body.value, "global"), 200);
    } catch (error) {
      if (error instanceof ExtensionSettingError) return settingErrorResponse(c, error);
      throw error;
    }
  };
};

export const deleteGlobalExtensionSettingHandler = (
  deps: ExtensionsRouteDeps,
): AppRouteHandler<typeof deleteGlobalExtensionSettingRoute> => {
  return async (c) => {
    const { installName, key } = c.req.valid("param");
    const context = await resolveGlobalSettingsContext(deps, installName);
    if (!context) return c.json({ error: `Installed extension not found: ${installName}` }, 404);
    try {
      await deps.extensionSettingsService.delete(context, key, "global");
      return c.body(null, 204);
    } catch (error) {
      if (error instanceof ExtensionSettingError) return settingErrorResponse(c, error);
      throw error;
    }
  };
};
