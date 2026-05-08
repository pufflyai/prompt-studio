import { createApp } from "pstdio-api/app";
import { createLogger } from "pstdio-logging";
import { CLI_VERSION } from "@/features/cli-version";
import { resolveFilesRoot } from "@/features/resolve-files-root";
import { injectConfig } from "../../dashboard/serve-dashboard";
import { isCompiledBinary, loadEmbeddedAssets, resolveMimeType } from "./embedded-assets";
import { loadFilesystemAssets } from "./filesystem-assets";

type ServeAppOptions = {
  port: number;
  host: string;
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
  reportStartupError: (error: Error) => void;
  onSignal: (signal: NodeJS.Signals, listener: () => void) => void;
  offSignal: (signal: NodeJS.Signals, listener: () => void) => void;
  exit: (code?: number) => never;
};

let serveLogger: ReturnType<typeof createLogger> | null = null;

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const getServeLogger = () => {
  if (serveLogger) {
    return serveLogger;
  }

  serveLogger = createLogger({ component: "serve", service: "pstdio" });
  return serveLogger;
};

const reportStartupError = (error: Error) => {
  getServeLogger().error(
    {
      event: "serve.startup.error",
      message: error.message,
      stack: error.stack,
    },
    "pstdio serve failed to start",
  );
};

const defaultDeps: ServeAppDeps = {
  createApp: async () => createApp({ filesRoot: await resolveFilesRoot() }),
  injectConfig,
  isCompiledBinary,
  loadEmbeddedAssets,
  loadFilesystemAssets,
  resolveMimeType,
  serve: Bun.serve,
  log: (message) => process.stdout.write(message),
  reportStartupError,
  onSignal: (signal, listener) => process.on(signal, listener),
  offSignal: (signal, listener) => process.off(signal, listener),
  exit: (code = 0) => process.exit(code),
};

export const createServeApp = (overrides: Partial<ServeAppDeps> = {}) => {
  const deps = { ...defaultDeps, ...overrides };

  return async (options: ServeAppOptions) => {
    const { port, host } = options;
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
      const baseUrl = `http://${host}:${port}`;

      // Without this, "/" reaches resolveMimeType as-is — extname("/") is "",
      // which falls back to application/octet-stream and the browser downloads
      // the dashboard HTML instead of rendering it.
      const resolveAssetPath = (pathname: string) => (pathname === "/" ? "index.html" : pathname.slice(1));

      const serveHtml = (blob: Blob) =>
        blob.text().then((html) => {
          const injected = deps.injectConfig(html, { version: CLI_VERSION });
          return new Response(injected, { headers: { "Content-Type": "text/html" } });
        });

      const serveAsset = (assetPath: string, blob: Blob) => {
        const mimeType = deps.resolveMimeType(assetPath);

        if (mimeType === "text/html") {
          return serveHtml(blob);
        }

        return new Response(blob, { headers: { "Content-Type": mimeType } });
      };

      deps.serve({
        idleTimeout: 20,
        hostname: host,
        port,
        fetch(req) {
          const url = new URL(req.url);

          // API routes → Hono
          if (url.pathname.startsWith("/v1") || url.pathname === "/healthz" || url.pathname === "/shutdown") {
            return app.fetch(req);
          }

          // Dashboard assets → embedded or filesystem
          const assetPath = resolveAssetPath(url.pathname);
          const asset = assets.get(assetPath);
          if (asset) {
            return serveAsset(assetPath, asset);
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
      if (!LOCALHOST_HOSTS.has(host)) {
        deps.log(`  WARNING: bound to ${host}; pstdio serve has no auth, only expose on trusted networks.\n`);
        if (host === "0.0.0.0" || host === "::") {
          deps.log("  LAN clients should connect with this machine's LAN IP address.\n");
        }
      }
    } catch (error) {
      removeShutdownListeners();
      await closeApp();
      if (error instanceof Error) {
        deps.reportStartupError(error);
      }
      throw error;
    }
  };
};

export const serveApp = createServeApp();
