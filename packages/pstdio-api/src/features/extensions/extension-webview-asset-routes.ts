import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps } from "./deps";
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

  // Surface webview build failures through the dashboard's dynamic import path instead of a 404.
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

export const registerExtensionWebviewAssetRoutes = (routes: OpenAPIHono<AppBindings>, deps: ExtensionsRouteDeps) => {
  routes.get("/extensions/installed/:installName/webviews/*", serveWebviewAsset(deps));
};
