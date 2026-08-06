import { afterEach, describe, expect, test } from "bun:test";
import { type ChildProcess, spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PSTDIO_CLI } from "./helpers";
import { getFreePort, waitForReady } from "./start-api";
import { TEST_TIMEOUT } from "./timeouts";

const isReachable = async (url: string) => {
  try {
    const res = await fetch(`${url}/healthz`);
    return res.ok;
  } catch {
    return false;
  }
};

const waitForUnreachable = async (url: string) => {
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (!(await isReachable(url))) {
      return true;
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  return false;
};

const runClose = async (homePath: string) => {
  const cli = spawn("bun", ["run", PSTDIO_CLI, "close"], {
    cwd: join(import.meta.dirname, "../.."),
    env: {
      ...process.env,
      PSTDIO_DEFAULT_EXTENSIONS: "[]",
      PSTDIO_DISABLE_API_AUTO_START: "1",
      PSTDIO_DISABLE_EMBED_MANIFEST: "1",
      PSTDIO_HOME: homePath,
    },
    stdio: "pipe",
  });
  let stdout = "";
  let stderr = "";
  cli.stdout?.on("data", (chunk) => {
    stdout += String(chunk);
  });
  cli.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  const exitCode = await new Promise<number | null>((resolve) => cli.once("exit", resolve));
  if (exitCode !== 0) throw new Error(stderr);
  return stdout;
};

describe("pstdio close", () => {
  let runtimeToCleanup: ChildProcess | null = null;

  afterEach(async () => {
    const runtime = runtimeToCleanup;
    runtimeToCleanup = null;
    if (!runtime || runtime.exitCode !== null || runtime.signalCode !== null) return;

    const exited = new Promise<void>((resolve) => runtime.once("exit", () => resolve()));
    runtime.kill();
    await exited;
  });

  test(
    "shuts down a running API",
    async () => {
      const port = await getFreePort();
      const url = `http://127.0.0.1:${port}`;
      const homePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-close-home-"));
      runtimeToCleanup = spawn(
        "bun",
        ["run", PSTDIO_CLI, "serve", "--foreground", "--owner", "persistent", "--port", String(port)],
        {
          cwd: join(import.meta.dirname, "../.."),
          env: {
            ...process.env,
            PSTDIO_DB_PATH: ":memory:",
            PSTDIO_DEFAULT_EXTENSIONS: "[]",
            PSTDIO_DISABLE_EMBED_MANIFEST: "1",
            PSTDIO_HOME: homePath,
            PSTDIO_STORAGE_PATH: join(homePath, "storage"),
          },
          stdio: "pipe",
        },
      );
      await waitForReady(url);

      expect(await isReachable(url)).toBe(true);

      const output = await runClose(homePath);

      expect(output).toContain("Runtime stopped.");

      expect(await waitForUnreachable(url)).toBe(true);
      runtimeToCleanup = null;
    },
    TEST_TIMEOUT,
  );

  test(
    "does not auto-start when API is not running",
    async () => {
      const port = await getFreePort();
      const url = `http://localhost:${port}`;

      expect(await isReachable(url)).toBe(false);

      const homePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-close-home-"));

      const output = await runClose(homePath);

      expect(output).toContain("Runtime is not running.");

      expect(await waitForUnreachable(url)).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
