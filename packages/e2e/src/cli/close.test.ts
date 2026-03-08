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
      const api = await startApi();
      apiToCleanup = api;

      expect(await isReachable(api.url)).toBe(true);

      const output = runPstdio("close", process.cwd(), { PSTDIO_API_URL: api.url });

      expect(output).toContain("API stopped.");

      // Give it a moment to shut down
      await new Promise((r) => setTimeout(r, 500));
      expect(await isReachable(api.url)).toBe(false);
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

      await new Promise((r) => setTimeout(r, 500));
      expect(await isReachable(url)).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
