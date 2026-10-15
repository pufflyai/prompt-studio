import { createRoute, z } from "@hono/zod-openapi";
import type { AppRouteHandler } from "../../../types";
import type { RouteDeps } from "../../deps";
import type { ExtensionsRouteDeps } from "../deps";

type PreferenceRouteDeps = Pick<ExtensionsRouteDeps, "extensionService" | "eventBus"> &
  Pick<RouteDeps, "webviewPreferencesDBService">;
const scopeSchema = z.enum(["default", "user", "project", "workspace", "extension", "session"]);
const query = z.object({ scope: scopeSchema.optional(), scopeId: z.string().optional() }).strict();
const value = z.union([
  z.boolean(),
  z.number(),
  z.string(),
  z.array(z.string()),
  z.array(z.number()),
  z.array(z.boolean()),
  z.record(z.string(), z.json()).openapi({ type: "object", additionalProperties: true }),
]);
const result = z.object({ name: z.string(), value: value.optional() });
const error = z.object({ error: z.string(), code: z.string().optional() });
const responses = {
  200: { description: "Stored preference.", content: { "application/json": { schema: result } } },
  400: { description: "Invalid preference.", content: { "application/json": { schema: error } } },
  404: { description: "Extension not found.", content: { "application/json": { schema: error } } },
};
const params = z.object({ projectId: z.string(), instanceId: z.string(), name: z.string().min(1).max(256) }).strict();
export const getWebviewPreferenceRoute = createRoute({
  method: "get",
  path: "/projects/{projectId}/extensions/{instanceId}/preferences/{name}",
  description: "Read an extension-owned server preference. Uses the same storage as webviews.",
  tags: ["Extensions"],
  request: { params, query },
  responses,
});
export const setWebviewPreferenceRoute = createRoute({
  method: "put",
  path: getWebviewPreferenceRoute.path,
  description: "Write an extension-owned server preference. Uses the same storage as webviews.",
  tags: ["Extensions"],
  request: { params, query, body: { content: { "application/json": { schema: z.object({ value }).strict() } } } },
  responses,
});

const keyFor = (extensionId: string, name: string, projectId: string, scope?: z.infer<typeof query>) => {
  const scopeType = scope?.scope === "extension" ? "user" : (scope?.scope ?? "user");
  let scopeId = scope?.scopeId ?? "";
  if (scope?.scope === "project") scopeId = scope.scopeId ?? projectId;
  if (scope?.scope === "extension") scopeId = "";
  return { extension_id: extensionId, name, scope_type: scopeType, scope_id: scopeId };
};

export const getWebviewPreferenceHandler =
  (deps: PreferenceRouteDeps): AppRouteHandler<typeof getWebviewPreferenceRoute> =>
  async (c) => {
    const { projectId, instanceId, name } = c.req.valid("param");
    const record = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!record) return c.json({ error: "Extension instance not found" }, 404);
    const key = keyFor(record.installedSource.extension_id, name, projectId, c.req.valid("query"));
    if ((key.scope_type === "workspace" || key.scope_type === "session") && !key.scope_id)
      return c.json({ error: "Scope requires scopeId", code: "preference_scope_invalid" }, 400);
    const stored = key.scope_type === "default" ? undefined : await deps.webviewPreferencesDBService.get(key);
    const fallback =
      stored === undefined && key.scope_type !== "default" && !(key.scope_type === "user" && !key.scope_id)
        ? await deps.webviewPreferencesDBService.get({ ...key, scope_type: "user", scope_id: "" })
        : stored;
    return c.json({ name, ...(fallback !== undefined ? { value: fallback as z.infer<typeof value> } : {}) }, 200);
  };
export const setWebviewPreferenceHandler =
  (deps: PreferenceRouteDeps): AppRouteHandler<typeof setWebviewPreferenceRoute> =>
  async (c) => {
    const { projectId, instanceId, name } = c.req.valid("param");
    const record = await deps.extensionService.getProjectExtensionInstance(projectId, instanceId);
    if (!record) return c.json({ error: "Extension instance not found" }, 404);
    const key = keyFor(record.installedSource.extension_id, name, projectId, c.req.valid("query"));
    if (key.scope_type === "default")
      return c.json({ error: "Default scope is read only", code: "preference_scope_read_only" }, 400);
    const body = c.req.valid("json");
    if ((key.scope_type === "workspace" || key.scope_type === "session") && !key.scope_id)
      return c.json({ error: "Scope requires scopeId", code: "preference_scope_invalid" }, 400);
    try {
      await deps.webviewPreferencesDBService.set({ ...key, value_json: body.value });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("preference_too_large"))
        return c.json({ error: error.message, code: "preference_too_large" }, 400);
      throw error;
    }
    deps.eventBus.emit("webview_preferences", "set", { ...key, value: body.value });
    return c.json({ name, value: body.value }, 200);
  };

const globalParams = z.object({ installName: z.string(), name: z.string().min(1).max(256) }).strict();
export const getGlobalWebviewPreferenceRoute = createRoute({
  method: "get",
  path: "/extensions/installed/{installName}/preferences/{name}",
  tags: ["Extensions"],
  request: { params: globalParams, query },
  responses,
});
export const setGlobalWebviewPreferenceRoute = createRoute({
  method: "put",
  path: getGlobalWebviewPreferenceRoute.path,
  tags: ["Extensions"],
  request: {
    params: globalParams,
    query,
    body: { content: { "application/json": { schema: z.object({ value }).strict() } } },
  },
  responses,
});
export const getGlobalWebviewPreferenceHandler =
  (deps: PreferenceRouteDeps): AppRouteHandler<typeof getGlobalWebviewPreferenceRoute> =>
  async (c) => {
    const { installName, name } = c.req.valid("param");
    const record = await deps.extensionService.getInstalledSource(installName);
    if (!record) return c.json({ error: "Installed extension not found" }, 404);
    const key = keyFor(record.extension_id, name, "", c.req.valid("query"));
    if (["project", "workspace", "session"].includes(key.scope_type) && !key.scope_id)
      return c.json({ error: "Scope requires scopeId", code: "preference_scope_invalid" }, 400);
    let stored = key.scope_type === "default" ? undefined : await deps.webviewPreferencesDBService.get(key);
    if (stored === undefined && key.scope_type !== "default" && !(key.scope_type === "user" && !key.scope_id))
      stored = await deps.webviewPreferencesDBService.get({ ...key, scope_type: "user", scope_id: "" });
    return c.json({ name, ...(stored !== undefined ? { value: stored as z.infer<typeof value> } : {}) }, 200);
  };
export const setGlobalWebviewPreferenceHandler =
  (deps: PreferenceRouteDeps): AppRouteHandler<typeof setGlobalWebviewPreferenceRoute> =>
  async (c) => {
    const { installName, name } = c.req.valid("param");
    const record = await deps.extensionService.getInstalledSource(installName);
    if (!record) return c.json({ error: "Installed extension not found" }, 404);
    const key = keyFor(record.extension_id, name, "", c.req.valid("query"));
    if (key.scope_type === "default")
      return c.json({ error: "Default scope is read only", code: "preference_scope_read_only" }, 400);
    const body = c.req.valid("json");
    if (["project", "workspace", "session"].includes(key.scope_type) && !key.scope_id)
      return c.json({ error: "Scope requires scopeId", code: "preference_scope_invalid" }, 400);
    try {
      await deps.webviewPreferencesDBService.set({ ...key, value_json: body.value });
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("preference_too_large"))
        return c.json({ error: error.message, code: "preference_too_large" }, 400);
      throw error;
    }
    deps.eventBus.emit("webview_preferences", "set", { ...key, value: body.value });
    return c.json({ name, value: body.value }, 200);
  };
