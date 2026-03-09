import { createApp } from "pstdio-api/app";
import { injectConfig } from "../../dashboard/serve-dashboard";
import { resolveDefaultDbPath, resolveDefaultStoragePath } from "../../dashboard/state-paths";
import { isCompiledBinary, loadEmbeddedAssets, resolveMimeType } from "./embedded-assets";
import { loadFilesystemAssets } from "./filesystem-assets";

type ServeAppOptions = {
  port: number;
};

const ensureRuntimeEnv = () => {
  if (!process.env.PSTDIO_DB_PATH) {
    process.env.PSTDIO_DB_PATH = resolveDefaultDbPath();
  }
  if (!process.env.PSTDIO_STORAGE_PATH) {
    process.env.PSTDIO_STORAGE_PATH = resolveDefaultStoragePath();
  }
};

export const serveApp = async (options: ServeAppOptions) => {
  const { port } = options;
  ensureRuntimeEnv();
  const { app, close } = await createApp();

  const shutdown = async () => {
    await close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  const assets = isCompiledBinary() ? loadEmbeddedAssets() : loadFilesystemAssets();
  const baseUrl = `http://localhost:${port}`;
  const appVersion = process.env.PSTDIO_VERSION ?? "dev";

  const resolveAsset = (pathname: string) => {
    const assetPath = pathname === "/" ? "index.html" : pathname.slice(1);
    return assets.get(assetPath) ?? null;
  };

  const serveHtml = (blob: Blob) =>
    blob.text().then((html) => {
      const injected = injectConfig(html, { apiBaseUrl: baseUrl, version: appVersion });
      return new Response(injected, { headers: { "Content-Type": "text/html" } });
    });

  const serveAsset = (pathname: string, blob: Blob) => {
    const mimeType = resolveMimeType(pathname);

    if (mimeType === "text/html") {
      return serveHtml(blob);
    }

    return new Response(blob, { headers: { "Content-Type": mimeType } });
  };

  Bun.serve({
    port,
    fetch(req) {
      const url = new URL(req.url);

      // API routes → Hono
      if (url.pathname.startsWith("/v1") || url.pathname === "/healthz" || url.pathname === "/shutdown") {
        return app.fetch(req);
      }

      // Dashboard assets → embedded or filesystem
      const asset = resolveAsset(url.pathname);
      if (asset) {
        return serveAsset(url.pathname, asset);
      }

      // SPA fallback → index.html for client-side routing
      const index = assets.get("index.html");
      if (index) {
        return serveHtml(index);
      }

      return new Response("Not Found", { status: 404 });
    },
  });

  process.stdout.write(`pstdio serve: ${baseUrl}\n`);
  process.stdout.write(`  Dashboard: ${baseUrl}\n`);
  process.stdout.write(`  API:       ${baseUrl}/v1\n`);
};
