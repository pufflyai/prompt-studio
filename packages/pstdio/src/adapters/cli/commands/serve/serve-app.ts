import { apiWebSocket, createApp } from "pstdio-api/app";
import { type RuntimeHost, type RuntimeOwnerType, runtimeSessionCookie } from "pstdio-api/runtime";
import { createLogger } from "pstdio-logging";
import { CLI_VERSION } from "@/features/cli-version";
import { resolveFilesRoot } from "@/features/resolve-files-root";
import { injectConfig } from "../../dashboard/serve-dashboard";
import { isCompiledBinary, loadEmbeddedAssets, resolveMimeType } from "./embedded-assets";
import { loadFilesystemAssets } from "./filesystem-assets";
import { createServeRuntime } from "./serve-runtime";

type ServeAppOptions = {
  port: number;
  host: string;
  ownerType?: RuntimeOwnerType;
  descriptorPath?: string;
  instanceId?: string;
  token?: string;
};

type AppHandle = {
  app: {
    fetch: (request: Request, server?: object) => Response | Promise<Response>;
  };
  close: () => Promise<void>;
};

type ServeAppDeps = {
  createApp: (runtimeHost?: RuntimeHost, onDatabaseLockAcquired?: () => void) => Promise<AppHandle>;
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
  onFatal: (event: "uncaughtException" | "unhandledRejection", listener: (error: unknown) => void) => void;
  offFatal: (event: "uncaughtException" | "unhandledRejection", listener: (error: unknown) => void) => void;
  exit: (code?: number) => never;
};

let serveLogger: ReturnType<typeof createLogger> | null = null;

const LOCALHOST_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

const getServeLogger = () => {
  if (serveLogger) {
    return serveLogger;
  }

  const autostartId = process.env.PSTDIO_AUTOSTART_ID;
  serveLogger = createLogger({
    base: autostartId ? { autostartId } : undefined,
    component: "serve",
    service: "pstdio",
    sync: true,
  });
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
  createApp: async (runtimeHost, onDatabaseLockAcquired) =>
    createApp({ filesRoot: await resolveFilesRoot(), onDatabaseLockAcquired, runtimeHost }),
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
  onFatal: (event, listener) => process.on(event, listener),
  offFatal: (event, listener) => process.off(event, listener),
  exit: (code = 0) => process.exit(code),
};

const isApiPath = (pathname: string) =>
  pathname.startsWith("/v1") || pathname.startsWith("/runtime/") || pathname === "/healthz" || pathname === "/readyz";

const createRequestHandler = (
  appReady: Promise<AppHandle>,
  assets: Map<string, Blob>,
  deps: Pick<ServeAppDeps, "injectConfig" | "resolveMimeType">,
  runtimeHost: RuntimeHost | undefined,
) => {
  const serveHtml = (request: Request, blob: Blob) =>
    blob.text().then((html) => {
      const injected = deps.injectConfig(html, { version: CLI_VERSION });
      const headers = new Headers({ "Content-Type": "text/html" });
      if (runtimeHost?.origin() === new URL(request.url).origin) {
        headers.set("set-cookie", runtimeSessionCookie(runtimeHost.token));
      }
      return new Response(injected, { headers });
    });

  const serveAsset = (request: Request, assetPath: string, blob: Blob) => {
    const mimeType = deps.resolveMimeType(assetPath);
    return mimeType === "text/html"
      ? serveHtml(request, blob)
      : new Response(blob, { headers: { "Content-Type": mimeType } });
  };

  return async (request: Request, server: object) => {
    const pathname = new URL(request.url).pathname;
    if (isApiPath(pathname)) return (await appReady).app.fetch(request, server);

    // Mapping root to index.html prevents browsers downloading it as application/octet-stream.
    const assetPath = pathname === "/" ? "index.html" : pathname.slice(1);
    const asset = assets.get(assetPath);
    if (asset) return serveAsset(request, assetPath, asset);

    const index = assets.get("index.html");
    return index ? serveHtml(request, index) : new Response("Not Found", { status: 404 });
  };
};

const publishBoundRuntime = (input: {
  baseUrl: string;
  log: ServeAppDeps["log"];
  runtime: NonNullable<ReturnType<typeof createServeRuntime>>;
}) => {
  const { baseUrl, log, runtime } = input;
  runtime.publish(baseUrl as `http://127.0.0.1:${number}`);
  log(`${JSON.stringify({ instanceId: runtime.host.instanceId, origin: baseUrl, type: "runtime_ready" })}\n`);
};

const logServeUrls = (host: string, baseUrl: string, log: ServeAppDeps["log"]) => {
  log(`pstdio serve: ${baseUrl}\n`);
  log(`  Dashboard: ${baseUrl}\n`);
  log(`  API:       ${baseUrl}/v1\n`);
  if (LOCALHOST_HOSTS.has(host)) return;

  log(`  WARNING: bound to ${host}; pstdio serve has no auth, only expose on trusted networks.\n`);
  if (host === "0.0.0.0" || host === "::") {
    log("  LAN clients should connect with this machine's LAN IP address.\n");
  }
};

export const createServeApp = (overrides: Partial<ServeAppDeps> = {}) => {
  const deps = { ...defaultDeps, ...overrides };

  return async (options: ServeAppOptions) => {
    const { port, host } = options;
    let appHandle: AppHandle | null = null;
    const appReady = Promise.withResolvers<AppHandle>();
    void appReady.promise.catch(() => {});
    let server: ReturnType<typeof Bun.serve> | null = null;
    let runtime: ReturnType<typeof createServeRuntime> = null;

    let closed = false;
    const closeApp = async () => {
      if (closed) {
        return;
      }

      closed = true;
      await (server as { stop?: () => void | Promise<void> } | null)?.stop?.();
      try {
        const handle = appHandle ?? (await appReady.promise.catch(() => null));
        await handle?.close();
      } finally {
        runtime?.cleanup();
      }
    };

    const removeShutdownListeners = () => {
      deps.offSignal("SIGINT", shutdown);
      deps.offSignal("SIGTERM", shutdown);
      deps.offFatal("uncaughtException", fatalShutdown);
      deps.offFatal("unhandledRejection", fatalShutdown);
    };

    const shutdown = () => {
      removeShutdownListeners();

      void closeApp().finally(() => {
        deps.exit(0);
      });
    };

    const fatalShutdown = (error: unknown) => {
      removeShutdownListeners();
      if (error instanceof Error) deps.reportStartupError(error);
      else deps.reportStartupError(new Error(String(error)));

      void closeApp();
      deps.exit(1);
    };

    runtime = createServeRuntime(options, async () => {
      removeShutdownListeners();
      await closeApp();
      deps.exit(0);
    });
    const runtimeHost = runtime?.host;

    try {
      deps.onSignal("SIGINT", shutdown);
      deps.onSignal("SIGTERM", shutdown);
      deps.onFatal("uncaughtException", fatalShutdown);
      deps.onFatal("unhandledRejection", fatalShutdown);

      const assets = deps.isCompiledBinary() ? deps.loadEmbeddedAssets() : deps.loadFilesystemAssets();

      server = deps.serve({
        idleTimeout: 20,
        hostname: host,
        port,
        fetch: createRequestHandler(appReady.promise, assets, deps, runtimeHost),
        websocket: apiWebSocket,
      });

      const boundPort = server.port || port;
      if (!boundPort) throw new Error("pstdio serve did not report its bound port");
      const baseUrl = runtimeHost ? `http://127.0.0.1:${boundPort}` : `http://${host}:${boundPort}`;
      const publishRuntime = () => {
        if (runtime) publishBoundRuntime({ baseUrl, log: deps.log, runtime });
      };

      logServeUrls(host, baseUrl, deps.log);

      appHandle = await deps.createApp(runtimeHost, publishRuntime);
      appReady.resolve(appHandle);
    } catch (error) {
      appReady.reject(error);
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
