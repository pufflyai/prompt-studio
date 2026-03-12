import { createApp } from "pstdio-api/app";
import { injectConfig } from "../../dashboard/serve-dashboard";
import { resolveDefaultDbPath, resolveDefaultStoragePath } from "../../dashboard/state-paths";
import { isCompiledBinary, loadEmbeddedAssets, resolveMimeType } from "./embedded-assets";
import { loadFilesystemAssets } from "./filesystem-assets";

type ServeAppOptions = {
  port: number;
};

type AppHandle = {
  app: {
    fetch: (request: Request) => Response | Promise<Response>;
  };
  close: () => Promise<void>;
};

type ServeAppDeps = {
  createApp: () => Promise<AppHandle>;
  injectConfig: typeof injectConfig;
  isCompiledBinary: typeof isCompiledBinary;
  loadEmbeddedAssets: typeof loadEmbeddedAssets;
  loadFilesystemAssets: typeof loadFilesystemAssets;
  resolveMimeType: typeof resolveMimeType;
  serve: typeof Bun.serve;
  log: (message: string) => void;
  onSignal: (signal: NodeJS.Signals, listener: () => void) => void;
  offSignal: (signal: NodeJS.Signals, listener: () => void) => void;
  exit: (code?: number) => never;
};

const ensureRuntimeEnv = () => {
  if (!process.env.PSTDIO_DB_PATH) {
    process.env.PSTDIO_DB_PATH = resolveDefaultDbPath();
  }
  if (!process.env.PSTDIO_STORAGE_PATH) {
    process.env.PSTDIO_STORAGE_PATH = resolveDefaultStoragePath();
  }
};

const defaultDeps: ServeAppDeps = {
  createApp,
  injectConfig,
  isCompiledBinary,
  loadEmbeddedAssets,
  loadFilesystemAssets,
  resolveMimeType,
  serve: Bun.serve,
  log: (message) => process.stdout.write(message),
  onSignal: (signal, listener) => process.on(signal, listener),
  offSignal: (signal, listener) => process.off(signal, listener),
  exit: (code = 0) => process.exit(code),
};

export const createServeApp = (overrides: Partial<ServeAppDeps> = {}) => {
  const deps = { ...defaultDeps, ...overrides };

  return async (options: ServeAppOptions) => {
    const { port } = options;
    ensureRuntimeEnv();
    const { app, close } = await deps.createApp();

    let closed = false;
    const closeApp = async () => {
      if (closed) {
        return;
      }

      closed = true;
      await close();
    };

    const removeShutdownListeners = () => {
      deps.offSignal("SIGINT", shutdown);
      deps.offSignal("SIGTERM", shutdown);
    };

    const shutdown = () => {
      removeShutdownListeners();

      void closeApp().finally(() => {
        deps.exit(0);
      });
    };

    deps.onSignal("SIGINT", shutdown);
    deps.onSignal("SIGTERM", shutdown);

    try {
      const assets = deps.isCompiledBinary() ? deps.loadEmbeddedAssets() : deps.loadFilesystemAssets();
      const baseUrl = `http://localhost:${port}`;
      const appVersion = process.env.PSTDIO_VERSION ?? "dev";

      const resolveAsset = (pathname: string) => {
        const assetPath = pathname === "/" ? "index.html" : pathname.slice(1);
        return assets.get(assetPath) ?? null;
      };

      const serveHtml = (blob: Blob) =>
        blob.text().then((html) => {
          const injected = deps.injectConfig(html, { apiBaseUrl: baseUrl, version: appVersion });
          return new Response(injected, { headers: { "Content-Type": "text/html" } });
        });

      const serveAsset = (pathname: string, blob: Blob) => {
        const mimeType = deps.resolveMimeType(pathname);

        if (mimeType === "text/html") {
          return serveHtml(blob);
        }

        return new Response(blob, { headers: { "Content-Type": mimeType } });
      };

      deps.serve({
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

      deps.log(`pstdio serve: ${baseUrl}\n`);
      deps.log(`  Dashboard: ${baseUrl}\n`);
      deps.log(`  API:       ${baseUrl}/v1\n`);
    } catch (error) {
      removeShutdownListeners();
      await closeApp();
      throw error;
    }
  };
};

export const serveApp = createServeApp();
