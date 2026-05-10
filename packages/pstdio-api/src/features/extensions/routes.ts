import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { getExtensionRuntimeScript, renderExtensionRuntimeHtml } from "pstdio-extensions/bridge/runtime";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps } from "./deps";
import { enableInstalledExtensionHandler, enableInstalledExtensionRoute } from "./endpoints/enable-installed-extension";
import { executeExtensionCommandHandler, executeExtensionCommandRoute } from "./endpoints/execute-extension-command";
import { getProjectExtensionUiHandler, getProjectExtensionUiRoute } from "./endpoints/get-project-extension-ui";
import { listExtensionAppearanceHandler, listExtensionAppearanceRoute } from "./endpoints/list-extension-appearance";
import { listExtensionCommandsHandler, listExtensionCommandsRoute } from "./endpoints/list-extension-commands";
import {
  updateInstalledExtensionTemplateHandler,
  updateInstalledExtensionTemplateRoute,
} from "./endpoints/update-installed-extension-template";
import {
  EXTENSION_RUNTIME_PATH,
  EXTENSION_RUNTIME_SCRIPT_PATH,
  EXTENSION_RUNTIME_SCRIPT_URL,
} from "./extension-runtime-routes";
import { resolveWebviewAssetFile } from "./extension-webview-assets";

const serveWebviewAsset = (deps: ExtensionsRouteDeps) => async (c: Context<AppBindings>) => {
  const installName = c.req.param("installName");
  if (!installName) return c.json({ error: "Webview asset not found" }, 404);
  const marker = `/extensions/installed/${installName}/webviews/`;
  const routeTail = c.req.path.slice(c.req.path.indexOf(marker) + marker.length);
  const [encodedWebviewId, ...assetPathParts] = routeTail.split("/");
  const webviewId = decodeURIComponent(encodedWebviewId ?? "");
  if (!webviewId) return c.json({ error: "Webview asset not found" }, 404);

  const asset = await resolveWebviewAssetFile(deps, {
    assetPath: decodeURIComponent(assetPathParts.join("/")),
    installName,
    webviewId,
  });

  if (!asset) return c.json({ error: "Webview asset not found" }, 404);

  return new Response(Bun.file(asset.filePath), {
    headers: { "content-type": asset.mimeType },
  });
};

export const createExtensionRoutes = (deps: ExtensionsRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();

  routes.openapi(enableInstalledExtensionRoute, enableInstalledExtensionHandler(deps));
  routes.openapi(updateInstalledExtensionTemplateRoute, updateInstalledExtensionTemplateHandler(deps));
  routes.openapi(listExtensionAppearanceRoute, listExtensionAppearanceHandler(deps) as never);
  routes.openapi(listExtensionCommandsRoute, listExtensionCommandsHandler(deps) as never);
  routes.openapi(getProjectExtensionUiRoute, getProjectExtensionUiHandler(deps) as never);
  routes.openapi(executeExtensionCommandRoute, executeExtensionCommandHandler(deps) as never);
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
