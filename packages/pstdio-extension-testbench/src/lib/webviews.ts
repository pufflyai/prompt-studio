import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { resolvePackageAssetPath } from "pstdio-extensions";
import { getExtensionRuntimeScript } from "pstdio-extensions/bridge/webview-runtime";
import { renderExtensionRuntimeHtml } from "pstdio-extensions/bridge/webview-runtime-html";
import { webviewHostLabel, webviewOriginLabel } from "pstdio-extensions/webview-origin";
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
  apiPrefix: string;
  buildWebview?: (input: { distDir: string; entryPath: string }) => Promise<string | undefined>;
  cacheRoot: string;
  /** Port of the testbench API server; webviews load from it on their extension's own origin. */
  port: number;
}

type WebviewBuildRecord = {
  distDir: string;
  error?: string;
  originLabel: string;
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

const response = (body: BodyInit, contentType: string, status = 200) =>
  new Response(body, { headers: { "content-type": contentType }, status });

const notFound = () => response("Not found", "text/plain", 404);

const serveBuildAsset = (build: WebviewBuildRecord, assetPath: string) => {
  if (build.error && assetPath === "module.js") {
    return response(`throw new Error(${JSON.stringify(build.error)});\n`, "application/javascript", 200);
  }
  if (build.error) return response(build.error, "text/plain", 500);

  const filePath = safeResolve(build.distDir, assetPath);
  if (!filePath || !existsSync(filePath)) return notFound();

  return new Response(Bun.file(filePath), {
    headers: { "content-type": mimeTypes[extname(filePath)] ?? "application/octet-stream" },
  });
};

// Like the Prompt Studio API, the testbench serves each extension's webviews on that
// extension's own `<label>.localhost` origin and nothing else on those origins.
export const createPreviewWebviewHost = (input: PreviewWebviewHostInput) => {
  const builds = new Map<string, WebviewBuildRecord>();
  const runBuild = input.buildWebview ?? buildWebview;
  const assetUrl = (originLabel: string, path: string) => `http://${originLabel}.localhost:${input.port}${path}`;

  const resolveWebview: ResolveWorkbenchExtensionWebview = ({ id, webview }) => {
    const build = builds.get(id);
    if (!build) return null;

    const { originLabel } = build;
    const styles = build.error
      ? []
      : readdirSync(build.distDir)
          .filter((file) => file.endsWith(".css"))
          .map((file) =>
            assetUrl(originLabel, `${input.apiPrefix}/webviews/${encodeURIComponent(id)}/${encodeURIComponent(file)}`),
          );

    return {
      ...webview,
      runtimeUrl: assetUrl(originLabel, `${input.apiPrefix}/runtime.html`),
      moduleUrl: assetUrl(originLabel, `${input.apiPrefix}/webviews/${encodeURIComponent(id)}/module.js`),
      styles,
      originLabel,
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
            originLabel: webviewOriginLabel(webview.extensionId),
          }));
          buildsByEntryPath.set(entryPath, pendingBuild);
        }
        return { id: webview.id, build: await pendingBuild };
      }),
    );

    builds.clear();
    for (const { id, build } of prepared) builds.set(id, build);
  };

  /** Answers every request on a webview origin; returns undefined for testbench app requests. */
  const handleRequest = (url: URL) => {
    const hostLabel = webviewHostLabel(url.host);
    if (!hostLabel) return undefined;

    if (url.pathname === `${input.apiPrefix}/runtime.html`) {
      return response(renderExtensionRuntimeHtml(`${input.apiPrefix}/runtime.bundle.js`), "text/html");
    }
    if (url.pathname === `${input.apiPrefix}/runtime.bundle.js`) {
      return response(getExtensionRuntimeScript(), "application/javascript");
    }

    const match = url.pathname.match(new RegExp(`^${input.apiPrefix}/webviews/([^/]+)/(.*)$`));
    if (!match) return notFound();

    const webviewId = decodeURIComponent(match[1]!);
    const assetPath = decodeURIComponent(match[2] || "module.js");
    const build = builds.get(webviewId);
    if (!build || build.originLabel !== hostLabel) return notFound();
    return serveBuildAsset(build, assetPath);
  };

  return {
    cleanup: () => rmSync(input.cacheRoot, { recursive: true, force: true }),
    handleRequest,
    prepareWebviews,
    resolveWebview,
  };
};
