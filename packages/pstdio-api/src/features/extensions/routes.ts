import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { getExtensionRuntimeScript, renderExtensionRuntimeHtml } from "pstdio-extensions/bridge/runtime";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps } from "./deps";
import { enableInstalledExtensionHandler, enableInstalledExtensionRoute } from "./endpoints/enable-installed-extension";
import { executeExtensionCommandHandler, executeExtensionCommandRoute } from "./endpoints/execute-extension-command";
import {
  deleteGlobalExtensionSettingHandler,
  deleteGlobalExtensionSettingRoute,
  deleteProjectExtensionSettingHandler,
  deleteProjectExtensionSettingRoute,
  getGlobalExtensionSettingHandler,
  getGlobalExtensionSettingRoute,
  getProjectExtensionSettingHandler,
  getProjectExtensionSettingRoute,
  listGlobalExtensionSettingsHandler,
  listGlobalExtensionSettingsRoute,
  listProjectExtensionSettingsHandler,
  listProjectExtensionSettingsRoute,
  updateGlobalExtensionSettingHandler,
  updateGlobalExtensionSettingRoute,
  updateProjectExtensionSettingHandler,
  updateProjectExtensionSettingRoute,
} from "./endpoints/extension-settings";
import { getProjectExtensionUiHandler, getProjectExtensionUiRoute } from "./endpoints/get-project-extension-ui";
import { listExtensionAppearanceHandler, listExtensionAppearanceRoute } from "./endpoints/list-extension-appearance";
import { listExtensionCommandsHandler, listExtensionCommandsRoute } from "./endpoints/list-extension-commands";
import { listProjectExtensionsHandler, listProjectExtensionsRoute } from "./endpoints/list-project-extensions";
import {
  setProjectExtensionEnabledHandler,
  setProjectExtensionEnabledRoute,
} from "./endpoints/set-project-extension-enabled";
import {
  uninstallProjectExtensionHandler,
  uninstallProjectExtensionRoute,
} from "./endpoints/uninstall-project-extension";
import {
  updateInstalledExtensionTemplateHandler,
  updateInstalledExtensionTemplateRoute,
} from "./endpoints/update-installed-extension-template";
import {
  EXTENSION_RUNTIME_PATH,
  EXTENSION_RUNTIME_SCRIPT_PATH,
  EXTENSION_RUNTIME_SCRIPT_URL,
} from "./extension-runtime-routes";
import {
  findWebviewBuildError,
  renderWebviewBuildErrorModule,
  resolveWebviewAssetFile,
} from "./extension-webview-assets";

const serveWebviewAsset = (deps: ExtensionsRouteDeps) => async (c: Context<AppBindings>) => {
  const installName = c.req.param("installName");
  if (!installName) return c.json({ error: "Webview asset not found" }, 404);
  const marker = `/extensions/installed/${installName}/webviews/`;
  const routeTail = c.req.path.slice(c.req.path.indexOf(marker) + marker.length);
  const [encodedWebviewId, ...assetPathParts] = routeTail.split("/");
  const webviewId = decodeURIComponent(encodedWebviewId ?? "");
  if (!webviewId) return c.json({ error: "Webview asset not found" }, 404);

  const assetPath = decodeURIComponent(assetPathParts.join("/"));
  const asset = await resolveWebviewAssetFile(deps, { assetPath, installName, webviewId });
  if (asset) {
    return new Response(Bun.file(asset.filePath), {
      headers: { "content-type": asset.mimeType },
    });
  }

  // When the managed bundle is missing because the build failed, surface the recorded build error
  // as a throwing JS module. The dashboard's dynamic import will reject with this message, which
  // the extension frame propagates to the host as a runtime error. Without this, the dashboard
  // would only see a generic 404 and have no way to tell the user why the view didn't load.
  const isDefaultModuleRequest = assetPath === "" || assetPath === "module.js";
  if (isDefaultModuleRequest) {
    const buildError = await findWebviewBuildError(deps, { installName, webviewId });
    if (buildError) {
      return new Response(renderWebviewBuildErrorModule(buildError), {
        headers: { "content-type": "application/javascript; charset=utf-8" },
      });
    }
  }

  return c.json({ error: "Webview asset not found" }, 404);
};

export const createExtensionRoutes = (deps: ExtensionsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(enableInstalledExtensionRoute, enableInstalledExtensionHandler(deps));
  routes.openapi(updateInstalledExtensionTemplateRoute, updateInstalledExtensionTemplateHandler(deps));
  routes.openapi(listExtensionAppearanceRoute, listExtensionAppearanceHandler(deps) as never);
  routes.openapi(listExtensionCommandsRoute, listExtensionCommandsHandler(deps) as never);
  routes.openapi(getProjectExtensionUiRoute, getProjectExtensionUiHandler(deps) as never);
  routes.openapi(executeExtensionCommandRoute, executeExtensionCommandHandler(deps) as never);
  routes.openapi(listProjectExtensionsRoute, listProjectExtensionsHandler(deps));
  routes.openapi(setProjectExtensionEnabledRoute, setProjectExtensionEnabledHandler(deps));
  routes.openapi(uninstallProjectExtensionRoute, uninstallProjectExtensionHandler(deps));
  routes.openapi(listProjectExtensionSettingsRoute, listProjectExtensionSettingsHandler(deps) as never);
  routes.openapi(getProjectExtensionSettingRoute, getProjectExtensionSettingHandler(deps) as never);
  routes.openapi(updateProjectExtensionSettingRoute, updateProjectExtensionSettingHandler(deps) as never);
  routes.openapi(deleteProjectExtensionSettingRoute, deleteProjectExtensionSettingHandler(deps) as never);
  routes.openapi(listGlobalExtensionSettingsRoute, listGlobalExtensionSettingsHandler(deps) as never);
  routes.openapi(getGlobalExtensionSettingRoute, getGlobalExtensionSettingHandler(deps) as never);
  routes.openapi(updateGlobalExtensionSettingRoute, updateGlobalExtensionSettingHandler(deps) as never);
  routes.openapi(deleteGlobalExtensionSettingRoute, deleteGlobalExtensionSettingHandler(deps) as never);
  routes.get("/extensions/installed/:installName/webviews/*", serveWebviewAsset(deps));
  routes.get(
    EXTENSION_RUNTIME_PATH,
    () =>
      new Response(renderExtensionRuntimeHtml(EXTENSION_RUNTIME_SCRIPT_URL), {
        headers: { "content-type": "text/html; charset=utf-8" },
      }),
  );
  routes.get(
    EXTENSION_RUNTIME_SCRIPT_PATH,
    () =>
      new Response(getExtensionRuntimeScript(), {
        headers: { "content-type": "application/javascript; charset=utf-8" },
      }),
  );

  return routes;
};
