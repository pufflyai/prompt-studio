import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";
import { preparePackagedExtensionSource } from "../packaged/packaged-extension-source";
import { type RuntimeDescriptor, runtimeAuthorization } from "../packaged/packaged-serve-helpers";

const repo = join(import.meta.dirname, "../../../..");

export const prepareMemoryExtensions = async (root: string, signal: AbortSignal, includeFixtures = true) => {
  const catalog = JSON.parse(readFileSync(join(repo, "packages/pstdio-api/files/extension-catalog.json"), "utf8")) as {
    extensions: { default?: boolean; alwaysEnabled?: boolean; installName: string; origin: { path: string } }[];
  };
  const defaults = catalog.extensions.filter((entry) => entry.default || entry.alwaysEnabled);
  const entries = [
    ...defaults.map((entry) => ({ name: entry.installName, path: entry.origin.path })),
    // Workspaces supplies the file browser. The deterministic harness supplies the completed conversation.
    ...(includeFixtures
      ? [
          { name: "pstdio-workspaces", path: "extensions/pstdio-workspaces" },
          { name: "workbench-fixture", path: "packages/workbench-fixture" },
        ]
      : []),
  ];
  const sources: { installName: string; source: string }[] = [];
  for (const entry of entries) {
    const source = await preparePackagedExtensionSource(join(root, entry.name), join(repo, entry.path), {
      install: true,
      signal,
    });
    sources.push({ installName: entry.name, source });
  }
  return { defaults: defaults.map((entry) => entry.installName), sources };
};

export const readMemoryRuntime = (home: string) => {
  const path = join(home, "runtime.json");
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as RuntimeDescriptor) : undefined;
};

export const memoryEnvironment = (home: string, defaults?: { installName: string; source: string }[]) => {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    HOME: home,
    PSTDIO_HOME: home,
    PSTDIO_DB_PATH: join(home, "db.sqlite"),
    PSTDIO_STORAGE_PATH: join(home, "storage"),
    PSTDIO_ACCOUNT_FILE: join(home, "account.json"),
    USERPROFILE: home,
    APPDATA: join(home, "app-data"),
    LOCALAPPDATA: join(home, "local-app-data"),
    XDG_CONFIG_HOME: join(home, "config"),
    PSTDIO_LOG_PATH: join(home, "logs.jsonl"),
    ...(defaults ? { PSTDIO_DEFAULT_EXTENSIONS: JSON.stringify({ defaultExtensions: defaults }) } : {}),
  };
  if (!defaults) delete env.PSTDIO_DEFAULT_EXTENSIONS;
  for (const key of [
    "ELECTRON_RUN_AS_NODE",
    "PSTDIO_API_URL",
    "PSTDIO_API_TOKEN",
    "PSTDIO_EXTENSION_SOURCE_ROOT",
    "PSTDIO_EXTENSION_RELEASE_REF",
    "PSTDIO_DESKTOP_EXTERNAL_RUNTIME",
  ])
    delete env[key];
  return env;
};

export const launchMemoryDesktop = async (
  executable: string,
  home: string,
  defaults: { installName: string; source: string }[] | undefined,
  signal: AbortSignal,
  launched: (pid: number) => void,
) => {
  mkdirSync(home, { recursive: true });
  const env = memoryEnvironment(home, defaults);
  const child = spawn(
    executable,
    ["--remote-debugging-port=0", `--user-data-dir=${join(home, "electron-user-data")}`],
    {
      cwd: home,
      env,
      stdio: "pipe",
      detached: true,
    },
  );
  if (!child.pid) throw new Error("Desktop did not start");
  launched(child.pid);
  const endpoint = Promise.withResolvers<string>();
  let stderr = "";
  child.stdout.resume();
  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
    const address = /DevTools listening on (ws:\/\/\S+)/.exec(stderr)?.[1];
    if (address) endpoint.resolve(address);
  });
  child.once("error", endpoint.reject);
  child.once("exit", (code) => endpoint.reject(new Error(`Desktop exited with ${code}`)));
  void endpoint.promise.catch(() => {});
  let browser: Awaited<ReturnType<typeof chromium.connectOverCDP>> | undefined;
  const close = async () => {
    if (child.exitCode === null && child.signalCode === null) {
      const exited = new Promise<void>((done) => child.once("close", () => done()));
      if (process.platform === "win32") {
        const killed = spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
        if (killed.status !== 0 && child.exitCode === null)
          throw new Error("Could not stop the owned desktop process tree");
      } else process.kill(-child.pid!, "SIGKILL");
      await exited;
    }
    const runtime = readMemoryRuntime(home);
    if (runtime) {
      try {
        process.kill(runtime.pid, "SIGKILL");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ESRCH") throw error;
      }
    }
    await browser?.close();
  };
  const abort = () => {
    void close();
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    let runtime: RuntimeDescriptor | undefined;
    while (!runtime) {
      signal.throwIfAborted();
      const descriptor = readMemoryRuntime(home);
      if (descriptor) {
        const ready = await fetch(`${descriptor.origin}/runtime/ready`, {
          headers: runtimeAuthorization(descriptor),
          signal,
        });
        if (ready.ok) runtime = descriptor;
      }
      if (!runtime) await Bun.sleep(100);
    }
    browser = await chromium.connectOverCDP(await endpoint.promise);
    return {
      browser,
      runtime,
      close: async () => {
        signal.removeEventListener("abort", abort);
        await close();
      },
    };
  } catch (error) {
    signal.removeEventListener("abort", abort);
    await close();
    throw error;
  }
};

export const memoryRequest = async (runtime: RuntimeDescriptor, path: string, body?: object) => {
  const response = await fetch(`${runtime.origin}/v1${path}`, {
    method: body ? "POST" : "GET",
    headers: { ...runtimeAuthorization(runtime), "content-type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`Memory workload ${path} returned HTTP ${response.status}`);
  return response.json();
};
