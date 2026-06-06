import type { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps } from "./deps";
import {
  findWebviewBuildError,
  renderWebviewBuildErrorModule,
  resolveWebviewAssetFile,
} from "./extension-webview-assets";

const decodeRouteSegment = (segment: string) => {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
};

const serveWebviewAsset = (deps: ExtensionsRouteDeps) => async (c: Context<AppBindings>) => {
  const installName = c.req.param("installName");
  if (!installName) return c.json({ error: "Webview asset not found" }, 404);

  const marker = `/extensions/installed/${encodeURIComponent(installName)}/webviews/`;
  const routeTail = c.req.path.slice(c.req.path.indexOf(marker) + marker.length);
  const [encodedWebviewId, ...assetPathParts] = routeTail.split("/");
  const webviewId = decodeRouteSegment(encodedWebviewId ?? "");
  if (!webviewId) return c.json({ error: "Webview asset not found" }, 404);

  const assetPath = decodeRouteSegment(assetPathParts.join("/"));
  if (assetPath === null) return c.json({ error: "Webview asset not found" }, 404);
  // Build failures must win over any previous bundle left on disk.
  const isDefaultModuleRequest = assetPath === "" || assetPath === "module.js";
  if (isDefaultModuleRequest) {
    const buildError = await findWebviewBuildError(deps, { installName, webviewId });
    if (buildError) {
      return new Response(renderWebviewBuildErrorModule(buildError), {
        headers: { "content-type": "application/javascript; charset=utf-8" },
      });
    }
  }

  const asset = await resolveWebviewAssetFile(deps, { assetPath, installName, webviewId });
  if (asset) {
    return new Response(Bun.file(asset.filePath), {
      headers: { "content-type": asset.mimeType },
    });
  }

  return c.json({ error: "Webview asset not found" }, 404);
};

export const registerExtensionWebviewAssetRoutes = (routes: OpenAPIHono<AppBindings>, deps: ExtensionsRouteDeps) => {
  routes.get("/extensions/installed/:installName/webviews/*", serveWebviewAsset(deps));
};
