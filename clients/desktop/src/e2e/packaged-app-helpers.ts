import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { type Browser, chromium, type Page } from "@playwright/test";
import type { RuntimeDescriptor } from "pstdio/runtime";

const desktopRoot = resolve(import.meta.dirname, "../..");

export const desktopVersion = JSON.parse(readFileSync(join(desktopRoot, "package.json"), "utf8")).version as string;

const outputRoot = () => join(desktopRoot, "out", `Prompt Studio-${process.platform}-${process.arch}`);

const executablePath = () => {
  if (process.platform === "darwin") {
    return join(outputRoot(), "Prompt Studio.app", "Contents", "MacOS", "Prompt Studio");
  }
  if (process.platform === "win32") return join(outputRoot(), "Prompt Studio.exe");
  return join(outputRoot(), "Prompt Studio");
};

const sidecarPath = () => {
  if (process.platform === "darwin") {
    return join(outputRoot(), "Prompt Studio.app", "Contents", "Resources", "bin", "pstdio");
  }
  return join(outputRoot(), "resources", "bin", process.platform === "win32" ? "pstdio.exe" : "pstdio");
};

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
  });

export type PackagedApp = {
  browser: Browser;
  child: ChildProcess;
  page: Page;
  readyInMs: number;
  runtime: RuntimeDescriptor;
};

export const launchPackagedApp = async (home: string): Promise<PackagedApp> => {
  const startedAt = Date.now();
  const child = spawn(
    executablePath(),
    ["--remote-debugging-port=0", `--user-data-dir=${join(home, "electron-user-data")}`],
    {
      cwd: home,
      env: packagedEnvironment(home),
      stdio: "pipe",
    },
  );
  const browser = await chromium.connectOverCDP(await waitForDevTools(child));
  const page = browser.contexts()[0]?.pages()[0];
  if (!page) throw new Error("Packaged app did not create a renderer page");
  const runtime = await waitForDescriptor(home);
  await page.waitForURL(`${runtime.origin}/`);
  await page.locator("#root").waitFor({ state: "visible" });
  return { browser, child, page, readyInMs: Date.now() - startedAt, runtime };
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
    const child = spawn(sidecarPath(), args, {
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

export const disposePackagedApp = async (app: PackagedApp | null) => {
  if (!app) return;
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
