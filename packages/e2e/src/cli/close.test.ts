import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPstdio, shutdownApiViaHttp } from "./helpers";
import { type ApiInstance, getFreePort, startApi } from "./start-api";
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

describe("pstdio close", () => {
  let apiToCleanup: ApiInstance | null = null;
  let portToCleanup: number | null = null;

  afterEach(async () => {
    if (apiToCleanup) {
      apiToCleanup.stop();
      apiToCleanup = null;
    }
    if (portToCleanup) {
      await shutdownApiViaHttp(`http://localhost:${portToCleanup}`);
      portToCleanup = null;
    }
  });

  test(
    "shuts down a running API",
    async () => {
      const api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: "[]" } });
      apiToCleanup = api;

      expect(await isReachable(api.url)).toBe(true);

      const output = runPstdio("close", process.cwd(), { PSTDIO_API_URL: api.url });

      expect(output).toContain("API stopped.");

      expect(await waitForUnreachable(api.url)).toBe(true);
      apiToCleanup = null;
    },
    TEST_TIMEOUT,
  );

  test(
    "does not auto-start when API is not running",
    async () => {
      const port = await getFreePort();
      const url = `http://localhost:${port}`;

      expect(await isReachable(url)).toBe(false);

      const storagePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-close-storage-"));

      const output = runPstdio("close", process.cwd(), {
        PSTDIO_API_URL: url,
        PSTDIO_API_PORT: String(port),
        PSTDIO_DB_PATH: ":memory:",
        PSTDIO_STORAGE_PATH: storagePath,
      });

      expect(output).toContain("API is not running.");

      expect(await waitForUnreachable(url)).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
