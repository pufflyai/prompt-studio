import { dirname } from "node:path";
import { OpenAPIHono } from "@hono/zod-openapi";
import type { Context } from "hono";
import { getExtensionRuntimeScript, renderInlineExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime";
import { apiLogger } from "../../lib/logger";
import { ProjectNotFoundError } from "../../services/extension-service";
import type { AppBindings } from "../../types";
import type { ExtensionsRouteDeps, ExtensionWebviewRouteDeps } from "./deps";
import {
  ARTIFACT_IMAGE_LIMIT_BYTES,
  artifactImageMediaType,
  resolveExtensionArtifactMount,
  safeArtifactPath,
} from "./extension-artifact-assets";
import { type AuthorizedExtensionWebviewRequest, withWebviewAssetRevision } from "./extension-webview-access";
import {
  findWebviewBuildError,
  renderWebviewBuildErrorModule,
  resolveWebviewAssetFile,
} from "./extension-webview-assets";
import { readWebviewEntryStyles } from "./extension-webview-entry-styles";

type WebviewAssetRouteDeps = Pick<
  ExtensionsRouteDeps,
  | "accountService"
  | "extensionRuntimeCatalog"
  | "extensionService"
  | "workspaceService"
  | "webviewCacheRoot"
  | "extensionStorageService"
  | "assetTransferService"
> &
  ExtensionWebviewRouteDeps;

const notFound = (c: Context<AppBindings>) => c.json({ error: "Webview asset not found" }, 404);

const serveArtifact = async (
  c: Context<AppBindings>,
  deps: WebviewAssetRouteDeps,
  authorized: Extract<AuthorizedExtensionWebviewRequest, { kind: "artifact" }>,
) => {
  // The signed URL only proves the bridge minted this grant; the mount lookup and
  // the safe-file-root containment checks still run before any bytes are read.
  const artifactPath = safeArtifactPath(authorized.artifactPath);
  if (!artifactPath) return notFound(c);

  const mediaType = artifactImageMediaType(artifactPath);
  if (!mediaType) return notFound(c);

  let resolved: Awaited<ReturnType<typeof resolveExtensionArtifactMount>>;
  try {
    resolved = await resolveExtensionArtifactMount(deps, {
      installedExtensionId: authorized.installedExtensionId,
      mountId: authorized.mountId,
      projectId: authorized.projectId,
    });
  } catch (error) {
    if (error instanceof ProjectNotFoundError) return notFound(c);
    throw error;
  }
  if (!resolved) return notFound(c);

  const file = await resolved.mount.statFile(artifactPath);
  if (!file) return notFound(c);
  if (file.size !== undefined && file.size > ARTIFACT_IMAGE_LIMIT_BYTES) {
    return c.json({ error: `Artifact image exceeds the ${ARTIFACT_IMAGE_LIMIT_BYTES.toString()} byte limit` }, 413);
  }

  // Copy into a fresh buffer so the body is typed over a plain ArrayBuffer.
  const bytes = new Uint8Array(await resolved.mount.readBytes(artifactPath));
  return c.body(bytes, 200, { "cache-control": "private, max-age=300", "content-type": mediaType });
};

const serveAuthorizedRequest = async (c: Context<AppBindings>, deps: WebviewAssetRouteDeps) => {
  const authorized = deps.extensionWebviewAccess.authorize(c.req.raw);
  if (!authorized) return notFound(c);

  if (authorized.kind === "runtime") {
    // Preload in the opaque iframe's own module map. A relative URL retains any proxy prefix.
    const moduleUrl = withWebviewAssetRevision("./assets/module.js", c.req.query("h"));
    return new Response(renderInlineExtensionRuntimeHtml(getExtensionRuntimeScript(), moduleUrl), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }

  if (authorized.kind === "artifact") return serveArtifact(c, deps, authorized);

  const { installedExtensionId, webviewId } = authorized;
  await deps.ensureExtensionWebviews(installedExtensionId, webviewId);
  // A failed replacement can leave a previous bundle on disk.
  if (authorized.kind === "stylesheet" || authorized.assetPath === "module.js") {
    const buildError = await findWebviewBuildError(deps, { installedExtensionId, webviewId });
    if (buildError) {
      if (authorized.kind === "stylesheet") return notFound(c);
      return new Response(renderWebviewBuildErrorModule(buildError), {
        headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" },
      });
    }
  }
  if (authorized.kind === "stylesheet") {
    const entry = await resolveWebviewAssetFile(deps, { installedExtensionId, webviewId, assetPath: "module.js" });
    if (!entry) return notFound(c);
    const distDir = dirname(entry.filePath);
    const [style] = readWebviewEntryStyles(distDir);
    if (!style) return new Response("", { headers: { "content-type": "text/css", "cache-control": "no-store" } });
    // Preserve the base URL of relative fonts, images and imports in the published CSS.
    const revision = entry.revision ?? c.req.query("h");
    const location = deps.extensionWebviewAccess.assetUrl(authorized, style, revision);
    return new Response(null, { status: 307, headers: { location, "cache-control": "no-store" } });
  }
  const { assetPath } = authorized;
  const asset = await resolveWebviewAssetFile(deps, { assetPath, installedExtensionId, webviewId });
  if (!asset) return notFound(c);

  return new Response(Bun.file(asset.filePath), {
    // Metadata can precede first-use preparation. Recheck the entry point even
    // when the browser still has the previous publication's revision in its URL.
    headers:
      assetPath === "module.js"
        ? { "content-type": asset.mimeType, "cache-control": "no-store" }
        : { "content-type": asset.mimeType },
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
