import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { stopChildProcess } from "./child-process";

export const STORYBOOK_BOOT_TIMEOUT_MS = 60_000;

export type StorybookPackageName = "ui" | "pstdio-dashboard" | "pstdio-workbench";

const sharedStorybooks = [
  {
    packageName: "ui",
    probeStoryId: "patterns-editors-mermaid-renderer--default",
    urlEnvironmentVariable: "E2E_STORYBOOK_UI_URL",
  },
  {
    packageName: "pstdio-dashboard",
    probeStoryId: "dashboard-sidenav--workspace-mode",
    urlEnvironmentVariable: "E2E_STORYBOOK_DASHBOARD_URL",
  },
  {
    packageName: "pstdio-workbench",
    probeStoryId: "pstdio-workbench-examples--workbench-modes",
    urlEnvironmentVariable: "E2E_STORYBOOK_WORKBENCH_URL",
  },
] as const satisfies ReadonlyArray<{
  packageName: StorybookPackageName;
  probeStoryId: string;
  urlEnvironmentVariable: string;
}>;

const getFreePort = async () =>
  new Promise<number>((resolvePort, reject) => {
    const server = createServer();

    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close();
        reject(new Error("Failed to allocate Storybook port"));
        return;
      }

      const port = address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolvePort(port);
      });
    });
  });

const waitForStorybook = async (baseUrl: string, process: ChildProcess, probeStoryId: string) => {
  const startedAt = Date.now();
  while (Date.now() - startedAt < STORYBOOK_BOOT_TIMEOUT_MS) {
    if (process.exitCode !== null) {
      throw new Error(`Storybook exited before it became reachable with code ${process.exitCode}`);
    }

    try {
      const response = await fetch(`${baseUrl}/iframe.html?id=${probeStoryId}`);
      if (response.ok) {
        return;
      }
    } catch {
      // Storybook is still starting.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }

  throw new Error("Timed out waiting for Storybook");
};

export const startStorybookServer = async (probeStoryId: string, packageName: StorybookPackageName = "ui") => {
  const port = await getFreePort();
  const repoRoot = resolve(import.meta.dirname, "../../..", "..");
  const packageRoot = resolve(repoRoot, "packages", packageName);
  const baseUrl = `http://127.0.0.1:${port}`;
  const storybook = spawn(
    "bun",
    [
      "x",
      "storybook",
      "dev",
      "--config-dir",
      resolve(packageRoot, ".storybook"),
      "--host",
      "127.0.0.1",
      "--port",
      String(port),
      "--ci",
    ],
    {
      cwd: packageRoot,
      env: {
        ...process.env,
        STORYBOOK_DISABLE_TELEMETRY: "1",
      },
      stdio: "pipe",
    },
  );
  storybook.stdout.resume();
  storybook.stderr.resume();

  try {
    await waitForStorybook(baseUrl, storybook, probeStoryId);
  } catch (error) {
    await stopChildProcess(storybook);
    throw error;
  }

  return { baseUrl, storybook };
};

const getSharedStorybook = (packageName: StorybookPackageName) =>
  sharedStorybooks.find((storybook) => storybook.packageName === packageName)!;

export const getSharedStorybookBaseUrl = (packageName: StorybookPackageName, env: NodeJS.ProcessEnv = process.env) =>
  env[getSharedStorybook(packageName).urlEnvironmentVariable];

interface StartSharedStorybooksOptions {
  env?: NodeJS.ProcessEnv;
  start?: (
    probeStoryId: string,
    packageName: StorybookPackageName,
  ) => Promise<{ baseUrl: string; storybook: ChildProcess }>;
  stop?: (storybook: ChildProcess | undefined) => Promise<void>;
}

export const startSharedStorybooks = async (options: StartSharedStorybooksOptions = {}) => {
  const env = options.env ?? process.env;
  const start = options.start ?? startStorybookServer;
  const stop = options.stop ?? stopChildProcess;
  const running: ChildProcess[] = [];

  try {
    for (const storybook of sharedStorybooks) {
      const started = await start(storybook.probeStoryId, storybook.packageName);
      running.push(started.storybook);
      env[storybook.urlEnvironmentVariable] = started.baseUrl;
    }
  } catch (error) {
    await Promise.all(running.map((storybook) => stop(storybook)));
    throw error;
  }

  return async () => {
    await Promise.all(running.map((storybook) => stop(storybook)));
  };
};
