import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { getExtensionRuntimeScript, renderInlineExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime";
import { apiLogger } from "../../lib/logger";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps, ExtensionWebviewRouteDeps } from "./deps";
import {
  findWebviewBuildError,
  renderWebviewBuildErrorModule,
  resolveWebviewAssetFile,
} from "./extension-webview-assets";

type WebviewAssetRouteDeps = Pick<ExtensionsRouteDeps, "extensionService" | "webviewCacheRoot"> &
  ExtensionWebviewRouteDeps;

const notFound = (c: Context<AppBindings>) => c.json({ error: "Webview asset not found" }, 404);

const serveAuthorizedRequest = async (c: Context<AppBindings>, deps: WebviewAssetRouteDeps) => {
  const authorized = deps.extensionWebviewAccess.authorize(c.req.raw);
  if (!authorized) return notFound(c);

  if (authorized.kind === "runtime") {
    return new Response(renderInlineExtensionRuntimeHtml(getExtensionRuntimeScript()), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  const { assetPath, installName, webviewId } = authorized;
  // Build failures must win over any previous bundle left on disk.
  if (assetPath === "module.js") {
    const buildError = await findWebviewBuildError(deps, { installName, webviewId });
    if (buildError) {
      return new Response(renderWebviewBuildErrorModule(buildError), {
        headers: { "content-type": "application/javascript; charset=utf-8" },
      });
    }
  }

  const asset = await resolveWebviewAssetFile(deps, { assetPath, installName, webviewId });
  if (!asset) return notFound(c);

  return new Response(Bun.file(asset.filePath), {
    headers: { "content-type": asset.mimeType },
  });
};

const applyAssetHeaders = (c: Context<AppBindings>, response: Response) => {
  response.headers.set("referrer-policy", "no-referrer");
  if (c.req.header("origin") === "null") {
    response.headers.set("access-control-allow-origin", "null");
    response.headers.set("vary", "Origin");
  }
  return response;
};

const withoutHeadBody = (request: Request, response: Response) => {
  if (request.method !== "HEAD") return response;
  return new Response(null, {
    headers: response.headers,
    status: response.status,
    statusText: response.statusText,
  });
};

const assetRealmHandler = (deps: WebviewAssetRouteDeps) => async (c: Context<AppBindings>) => {
  const start = performance.now();
  let status = 500;

  try {
    const origin = c.req.header("origin");
    let response: Response;
    if (origin && origin !== "null") {
      response = c.json({ error: "Forbidden" }, 403);
    } else {
      response = await serveAuthorizedRequest(c, deps);
    }

    response = withoutHeadBody(c.req.raw, applyAssetHeaders(c, response));
    status = response.status;
    return response;
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Internal server error";
    const message = deps.extensionWebviewAccess.redactPath(rawMessage || "Internal server error");
    const stack =
      error instanceof Error && error.stack ? deps.extensionWebviewAccess.redactPath(error.stack) : undefined;
    status = 500;
    apiLogger.error(
      {
        event: "extension.webview.asset.error",
        message,
        method: c.req.method,
        path: deps.extensionWebviewAccess.redactPath(c.req.path),
        stack,
        status,
      },
      "Extension webview asset request failed",
    );
    return withoutHeadBody(
      c.req.raw,
      applyAssetHeaders(c, c.json({ code: "internal_server_error", error: message }, 500)),
    );
  } finally {
    apiLogger.info(
      {
        duration_ms: Math.round(performance.now() - start),
        event: "extension.webview.asset.completed",
        method: c.req.method,
        path: deps.extensionWebviewAccess.redactPath(c.req.path),
        request_id: c.req.header("x-request-id"),
        status,
      },
      "Extension webview asset request completed",
    );
  }
};

export const createExtensionWebviewAssetRoutes = (deps: WebviewAssetRouteDeps) => {
  const routes = new OpenAPIHono<AppBindings>();
  const handler = assetRealmHandler(deps);

  routes.all("/extensions/webviews", handler);
  routes.all("/extensions/webviews/*", handler);

  return routes;
};
