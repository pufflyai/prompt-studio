import { type ChildProcess, spawn } from "node:child_process";
import { createServer } from "node:net";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";
import { stopChildProcess } from "./child-process";
import { type StorybookPackageName, sharedStorybooks } from "./storybook-config";

export const STORYBOOK_BOOT_TIMEOUT_MS = 60_000;

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
      const response = await fetch(`${baseUrl}/iframe.html?id=${probeStoryId}`, {
        signal: AbortSignal.timeout(Math.max(1, STORYBOOK_BOOT_TIMEOUT_MS - (Date.now() - startedAt))),
      });
      await response.body?.cancel();
      if (response.ok) {
        return;
      }
    } catch {
      // Storybook is still starting.
    }

    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }

  throw new Error(`Timed out waiting for Storybook story ${probeStoryId}`);
};

const warmStorybook = async (baseUrl: string, probeStoryId: string) => {
  const startedAt = Date.now();
  const remainingTime = () => Math.max(1, STORYBOOK_BOOT_TIMEOUT_MS - (Date.now() - startedAt));
  const browser = await chromium.launch({ timeout: remainingTime() });
  try {
    const page = await browser.newPage();
    await page.goto(`${baseUrl}/iframe.html?id=${probeStoryId}`, {
      timeout: remainingTime(),
      waitUntil: "domcontentloaded",
    });
    await page.locator("#storybook-root > *").first().waitFor({ state: "attached", timeout: remainingTime() });
  } finally {
    await browser.close();
  }
};

export const startStorybookServer = async (probeStoryId: string, packageName: StorybookPackageName = "ui") => {
  console.log(`Starting ${packageName} Storybook (${probeStoryId})`);
  const port = await getFreePort();
  const repoRoot = resolve(import.meta.dirname, "../../..", "..");
  const packageRoot = resolve(repoRoot, "packages", packageName);
  const baseUrl = `http://127.0.0.1:${port}`;
  const args = [
    resolve(import.meta.dirname, "static-storybook-server.ts"),
    resolve(packageRoot, "storybook-static"),
    String(port),
  ];
  const storybook = spawn("bun", args, {
    cwd: packageRoot,
    env: {
      ...process.env,
      STORYBOOK_DISABLE_TELEMETRY: "1",
    },
    stdio: "pipe",
  });
  let output = "";
  const captureOutput = (chunk: Buffer) => {
    output = (output + chunk.toString()).slice(-16_384);
  };
  storybook.stdout.on("data", captureOutput);
  storybook.stderr.on("data", captureOutput);

  try {
    await waitForStorybook(baseUrl, storybook, probeStoryId);
    console.log(`Loading ${packageName} story at ${baseUrl}`);
    await warmStorybook(baseUrl, probeStoryId);
    console.log(`${packageName} Storybook is ready`);
  } catch (error) {
    console.error(`Failed to start ${packageName} Storybook`, error);
    console.error(output);
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
  const selected = env.STORYBOOK_PACKAGES?.split(",");
  if (selected?.some((owner) => !sharedStorybooks.some((storybook) => storybook.packageName === owner)))
    throw new Error(`Unknown Storybook owner: ${env.STORYBOOK_PACKAGES}`);

  try {
    for (const storybook of sharedStorybooks) {
      if (selected && !selected.includes(storybook.packageName)) continue;
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
