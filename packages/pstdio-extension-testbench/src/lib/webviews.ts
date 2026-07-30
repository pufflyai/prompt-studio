import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { resolvePackageAssetPath } from "pstdio-extensions";
import { getExtensionRuntimeScript } from "pstdio-extensions/bridge/webview-runtime";
import { renderExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime-html";
import type {
  ResolveWorkbenchExtensionWebview,
  ResolveWorkbenchExtensionWebviewInput,
} from "pstdio-extensions/workbench";

const mimeTypes: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html",
  ".js": "application/javascript",
  ".json": "application/json",
  ".map": "application/json",
  ".mjs": "application/javascript",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

interface PreviewWebviewHostInput {
  apiOrigin?: string | (() => string | undefined);
  apiPrefix: string;
  buildWebview?: (input: { distDir: string; entryPath: string }) => Promise<string | undefined>;
  cacheRoot: string;
}

type WebviewBuildRecord = {
  distDir: string;
  error?: string;
};

const safeResolve = (root: string, requestedPath: string) => {
  const resolvedRoot = resolve(root);
  const resolvedPath = resolve(resolvedRoot, requestedPath);
  if (resolvedPath !== resolvedRoot && !resolvedPath.startsWith(`${resolvedRoot}${sep}`)) return null;
  return resolvedPath;
};

const buildWebview = async (input: { distDir: string; entryPath: string }) => {
  rmSync(input.distDir, { recursive: true, force: true });
  mkdirSync(input.distDir, { recursive: true });

  try {
    const result = await Bun.build({
      entrypoints: [input.entryPath],
      outdir: input.distDir,
      target: "browser",
      format: "esm",
      naming: {
        entry: "module.[ext]",
        asset: "[name]-[hash].[ext]",
      },
    });

    if (result.success) return undefined;
    return result.logs.map(String).join("\n") || "Webview build failed.";
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
};

const webviewHeaders = (contentType: string) => ({
  "access-control-allow-origin": "*",
  "content-type": contentType,
});

const response = (body: BodyInit, contentType: string, status = 200) =>
  new Response(body, { headers: webviewHeaders(contentType), status });

const trimTrailingSlash = (value: string) => value.replace(/\/$/, "");

export const createPreviewWebviewHost = (input: PreviewWebviewHostInput) => {
  const builds = new Map<string, WebviewBuildRecord>();
  const runBuild = input.buildWebview ?? buildWebview;
  const apiOrigin = () => {
    const value = typeof input.apiOrigin === "function" ? input.apiOrigin() : input.apiOrigin;
    return value ? trimTrailingSlash(value) : undefined;
  };
  const assetUrl = (path: string) => {
    const origin = apiOrigin();
    return origin ? `${origin}${path}` : path;
  };

  const resolveWebview: ResolveWorkbenchExtensionWebview = ({ id, webview }) => {
    const build = builds.get(id);
    if (!build) return null;

    const styles = build.error
      ? []
      : readdirSync(build.distDir)
          .filter((file) => file.endsWith(".css"))
          .map((file) => assetUrl(`${input.apiPrefix}/webviews/${encodeURIComponent(id)}/${encodeURIComponent(file)}`));

    return {
      ...webview,
      runtimeUrl: assetUrl(`${input.apiPrefix}/runtime.html`),
      moduleUrl: assetUrl(`${input.apiPrefix}/webviews/${encodeURIComponent(id)}/module.js`),
      styles,
    };
  };

  const prepareWebviews = async (webviews: ResolveWorkbenchExtensionWebviewInput[]) => {
    const buildsByEntryPath = new Map<string, Promise<WebviewBuildRecord>>();
    const prepared = await Promise.all(
      webviews.map(async (webview) => {
        const entryPath = resolvePackageAssetPath(webview.webview.entry, { sourcePath: webview.sourcePath });
        let pendingBuild = buildsByEntryPath.get(entryPath);
        if (!pendingBuild) {
          const distDir = resolve(input.cacheRoot, encodeURIComponent(webview.id));
          pendingBuild = runBuild({ distDir, entryPath }).then((error) => ({
            distDir,
            error: error || undefined,
          }));
          buildsByEntryPath.set(entryPath, pendingBuild);
        }
        return { id: webview.id, build: await pendingBuild };
      }),
    );

    builds.clear();
    for (const { id, build } of prepared) builds.set(id, build);
  };

  const handleRequest = (url: URL) => {
    if (url.pathname === `${input.apiPrefix}/runtime.html`) {
      return response(renderExtensionRuntimeHtml(assetUrl(`${input.apiPrefix}/runtime.bundle.js`)), "text/html");
    }
    if (url.pathname === `${input.apiPrefix}/runtime.bundle.js`) {
      return response(getExtensionRuntimeScript(), "application/javascript");
    }

    const match = url.pathname.match(new RegExp(`^${input.apiPrefix}/webviews/([^/]+)/(.*)$`));
    if (!match) return undefined;

    const webviewId = decodeURIComponent(match[1]!);
    const assetPath = decodeURIComponent(match[2] || "module.js");
    const build = builds.get(webviewId);
    if (!build) return response(`Unknown webview: ${webviewId}`, "text/plain", 404);
    if (build.error && assetPath === "module.js") {
      return response(`throw new Error(${JSON.stringify(build.error)});\n`, "application/javascript", 200);
    }
    if (build.error) return response(build.error, "text/plain", 500);

    const filePath = safeResolve(build.distDir, assetPath);
    if (!filePath || !existsSync(filePath)) return response("Not found", "text/plain", 404);

    return new Response(Bun.file(filePath), {
      headers: webviewHeaders(mimeTypes[extname(filePath)] ?? "application/octet-stream"),
    });
  };

  return {
    cleanup: () => rmSync(input.cacheRoot, { recursive: true, force: true }),
    handleRequest,
    prepareWebviews,
    resolveWebview,
  };
};
