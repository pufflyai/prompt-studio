import {
  apiWebSocket,
  assertListenHostAllowed,
  closeBeforeFatalExit,
  createApp,
  resolveAppConfig,
} from "pstdio-api/app";
import { disableExtensionMutationTimeout } from "pstdio-api/extensions/extension-request-timeout";
import type { RuntimeHost, RuntimeOwnerType } from "pstdio-api/runtime";
import { createLogger } from "pstdio-logging";
import { CLI_VERSION } from "@/features/cli-version";
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
  standaloneToken: () => string | undefined;
  log: (message: string) => void;
  reportStartupError: (error: Error) => void;
  onSignal: (signal: NodeJS.Signals, listener: () => void) => void;
  offSignal: (signal: NodeJS.Signals, listener: () => void) => void;
  onFatal: (event: "uncaughtException" | "unhandledRejection", listener: (error: unknown) => void) => void;
  offFatal: (event: "uncaughtException" | "unhandledRejection", listener: (error: unknown) => void) => void;
  exit: (code?: number) => never;
  fatalCloseTimeoutMs?: number;
};

let serveLogger: ReturnType<typeof createLogger> | null = null;

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
    createApp({
      config: resolveAppConfig({ env: process.env, defaultExtensionReleaseRef: `pstdio@${CLI_VERSION}` }),
      host: runtimeHost
        ? { kind: "runtime", runtime: runtimeHost }
        : { kind: "standalone", token: process.env.PSTDIO_API_TOKEN },
      lifecycle: { onDatabaseLockAcquired },
    }),
  injectConfig,
  isCompiledBinary,
  loadEmbeddedAssets,
  loadFilesystemAssets,
  resolveMimeType,
  serve: Bun.serve,
  standaloneToken: () => process.env.PSTDIO_API_TOKEN,
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

// Page loads never sign a browser in: anything that can reach the port could load a page. Browsers
// get their session from `pst` or the desktop shell, which hold the runtime token (ADR 0054).
const createRequestHandler = (
  appReady: Promise<AppHandle>,
  assets: Map<string, Blob>,
  deps: Pick<ServeAppDeps, "injectConfig" | "resolveMimeType">,
) => {
  const serveHtml = (blob: Blob) =>
    blob
      .text()
      .then(
        (html) =>
          new Response(deps.injectConfig(html, { version: CLI_VERSION }), { headers: { "Content-Type": "text/html" } }),
      );

  const serveAsset = (assetPath: string, blob: Blob) => {
    const mimeType = deps.resolveMimeType(assetPath);
    return mimeType === "text/html" ? serveHtml(blob) : new Response(blob, { headers: { "Content-Type": mimeType } });
  };

  return async (request: Request, server: object) => {
    const pathname = new URL(request.url).pathname;
    if (isApiPath(pathname)) {
      disableExtensionMutationTimeout(request, server);
      return (await appReady).app.fetch(request, server);
    }

    // Mapping root to index.html prevents browsers downloading it as application/octet-stream.
    const assetPath = pathname === "/" ? "index.html" : pathname.slice(1);
    const asset = assets.get(assetPath);
    if (asset) return serveAsset(assetPath, asset);

    const index = assets.get("index.html");
    return index ? serveHtml(index) : new Response("Not Found", { status: 404 });
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

    // Every caller waits for the same close, so a signal during a fatal close cannot exit early.
    let closing: Promise<void> | null = null;
    const closeApp = () =>
      (closing ??= (async () => {
        // Bun may keep this promise pending for upgraded browser connections. ADR 0009 keeps this
        // workaround isolated: start teardown, then release resources and let process exit close sockets.
        void (server as { stop?: (closeActiveConnections?: boolean) => void | Promise<void> } | null)?.stop?.(true);
        try {
          const handle = appHandle ?? (await appReady.promise.catch(() => null));
          await handle?.close();
        } finally {
          runtime?.cleanup();
        }
      })());

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

    let fatalExitStarted = false;
    const fatalShutdown = (error: unknown) => {
      if (error instanceof Error) deps.reportStartupError(error);
      else deps.reportStartupError(new Error(String(error)));
      if (fatalExitStarted) return;

      fatalExitStarted = true;
      // The listeners stay until exit: an unhandled error during close would otherwise end the
      // process while PGlite is still closing.
      void closeBeforeFatalExit(closeApp, deps.fatalCloseTimeoutMs).then(() => {
        removeShutdownListeners();
        deps.exit(1);
      });
    };

    runtime = createServeRuntime(options, async () => {
      removeShutdownListeners();
      await closeApp();
      deps.exit(0);
    });
    const runtimeHost = runtime?.host;

    try {
      assertListenHostAllowed(host, runtimeHost?.token ?? deps.standaloneToken());
      deps.onSignal("SIGINT", shutdown);
      deps.onSignal("SIGTERM", shutdown);
      deps.onFatal("uncaughtException", fatalShutdown);
      deps.onFatal("unhandledRejection", fatalShutdown);

      const assets = deps.isCompiledBinary() ? deps.loadEmbeddedAssets() : deps.loadFilesystemAssets();

      server = deps.serve({
        idleTimeout: 20,
        hostname: host,
        port,
        fetch: createRequestHandler(appReady.promise, assets, deps),
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
