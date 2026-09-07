import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Browser, chromium, type Page, test } from "@playwright/test";
import type { RuntimeDescriptor } from "pstdio/runtime";
import { redactSensitiveText } from "pstdio-logging";
import { resolvePackagedLayout } from "../packaging/package-layout";
import { LIFECYCLE_URL } from "../windows/lifecycle-protocol";
import { waitForWorkbenchPage } from "./desktop-pages";
import { startElectronTrace } from "./electron-trace";
import { waitForVisibleElement } from "./visible-element-timing";

const desktopRoot = resolve(import.meta.dirname, "../..");

export const desktopVersion = JSON.parse(readFileSync(join(desktopRoot, "package.json"), "utf8")).version as string;

const packageLayout = resolvePackagedLayout(desktopRoot, process.platform, process.arch);

const packagedEnvironment = (home: string) => {
  const env = Object.fromEntries(
    Object.entries({
      ...process.env,
      APPDATA: join(home, "app-data"),
      HOME: home,
      LOCALAPPDATA: join(home, "local-app-data"),
      PSTDIO_HOME: home,
      USERPROFILE: home,
      XDG_CONFIG_HOME: join(home, "config"),
    }).filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  delete env.ELECTRON_RUN_AS_NODE;
  return env;
};

export const createPackagedHome = () => mkdtempSync(join(tmpdir(), "pstdio-desktop-package-"));

export const readDescriptor = (home: string) => {
  const path = join(home, "runtime.json");
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf8")) as RuntimeDescriptor;
};

export const waitForDescriptor = async (home: string, predicate = (_descriptor: RuntimeDescriptor) => true) => {
  for (let attempt = 0; attempt < 100; attempt++) {
    const descriptor = readDescriptor(home);
    if (descriptor && predicate(descriptor)) return descriptor;
    await new Promise((resolveWait) => setTimeout(resolveWait, 100));
  }
  throw new Error("Packaged desktop runtime did not publish the expected descriptor");
};

const waitForDevTools = (child: ChildProcess) =>
  new Promise<string>((resolveConnection, rejectConnection) => {
    let stderr = "";
    const timeout = setTimeout(() => rejectConnection(new Error(`DevTools did not start\n${stderr}`)), 10_000);
    child.stderr?.on("data", (chunk) => {
      stderr += String(chunk);
      const connection = stderr.match(/DevTools listening on (ws:\/\/\S+)/)?.[1];
      if (!connection) return;
      clearTimeout(timeout);
      resolveConnection(connection);
    });
    child.once("exit", (code) => {
      clearTimeout(timeout);
      rejectConnection(new Error(`Packaged app exited with code ${code}\n${stderr}`));
    });
    child.once("error", (error) => {
      clearTimeout(timeout);
      rejectConnection(error);
    });
  });

export type PackagedWindow = {
  home: string;
  browser: Browser;
  child: ChildProcess;
  lifecyclePage: Page;
  startedAt: number;
  runtime: RuntimeDescriptor;
  finishTrace: () => Promise<void>;
};

export type PackagedApp = PackagedWindow & { page: Page; readyInMs: number };

export const attachStartupTimings = async (app: PackagedApp) => {
  const entries = await app.page.evaluate(() =>
    performance
      .getEntries()
      .filter((entry) => ["navigation", "resource"].includes(entry.entryType))
      .map((entry) => entry.toJSON()),
  );
  await test.info().attach("workbench-startup-performance", {
    body: JSON.stringify({ readyInMs: app.readyInMs, entries }),
    contentType: "application/json",
  });
};

export const launchPackagedWindow = async (
  home: string,
  runtimeEnvironment: Record<string, string> = {},
  startupArguments: string[] = [],
) => {
  const startedAt = Date.now();
  const child = spawn(
    packageLayout.executable,
    [...startupArguments, "--remote-debugging-port=0", `--user-data-dir=${join(home, "electron-user-data")}`],
    {
      cwd: home,
      env: { ...packagedEnvironment(home), ...runtimeEnvironment },
      stdio: "pipe",
    },
  );
  child.stdout.resume();
  let browser: Browser | null = null;
  try {
    const endpoint = await waitForDevTools(child);
    // Keep the debugging connection out of the spawned runtime. See ADR 0020.
    const runtime = await waitForDescriptor(home);
    browser = await chromium.connectOverCDP(endpoint);
    const context = browser.contexts()[0];
    const lifecyclePage = context?.pages().find((page) => page.url() === LIFECYCLE_URL) ?? context?.pages()[0];
    if (!lifecyclePage || !context) throw new Error("Packaged app did not create a lifecycle page");
    const finishTrace = await startElectronTrace(context, `packaged-${child.pid}`);
    return { home, browser, child, lifecyclePage, startedAt, runtime, finishTrace };
  } catch (error) {
    await browser?.close().catch(() => {});
    if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    throw error;
  }
};

export const launchPackagedApp = async (
  home: string,
  runtimeEnvironment: Record<string, string> = {},
  startupArguments: string[] = [],
) => {
  const app = await launchPackagedWindow(home, runtimeEnvironment, startupArguments);
  try {
    const page = await waitForWorkbenchPage(app.lifecyclePage, app.runtime.origin);
    const visibleAt = await waitForVisibleElement(page, "#root");
    return { ...app, page, readyInMs: visibleAt - app.startedAt };
  } catch (error) {
    await disposePackagedApp(app);
    throw error;
  }
};

export const waitForExit = (child: ChildProcess) =>
  new Promise<void>((resolveExit, rejectExit) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      resolveExit();
      return;
    }
    const timeout = setTimeout(() => rejectExit(new Error("Packaged app did not exit gracefully")), 10_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolveExit();
    });
  });

export const runPackagedCli = (home: string, args: string[]) =>
  new Promise<{ exitCode: number | null; stderr: string; stdout: string }>((resolveExit) => {
    const child = spawn(packageLayout.sidecar, args, {
      cwd: home,
      env: packagedEnvironment(home),
      stdio: "pipe",
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.once("exit", (exitCode) => resolveExit({ exitCode, stderr, stdout }));
  });

export const disposePackagedApp = async (app: PackagedWindow | null) => {
  if (!app) return;
  await app.finishTrace();
  const logPath = join(app.home, "logs.jsonl");
  const log = existsSync(logPath) ? readFileSync(logPath, "utf8").slice(-32_000) : "No runtime log was written.";
  await test.info().attach("runtime-log", {
    body: redactSensitiveText(log, [app.runtime.token]),
    contentType: "text/plain",
  });
  await app.browser.close().catch(() => {});
  if (app.child.exitCode === null && app.child.signalCode === null) app.child.kill("SIGKILL");
};

export const removePackagedHome = (home: string) => {
  const runtime = readDescriptor(home);
  if (runtime) {
    try {
      process.kill(runtime.pid, "SIGKILL");
    } catch {}
  }
  rmSync(home, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
};
