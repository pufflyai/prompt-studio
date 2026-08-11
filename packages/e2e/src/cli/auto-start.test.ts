import { afterEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPstdio, runPstdioSafe } from "./helpers";
import { getFreePort } from "./start-api";
import { TEST_TIMEOUT } from "./timeouts";

// Create git repos inside the monorepo tree so resolveApiRoot can walk up
// and find packages/pstdio-api for auto-start.
const TEST_TMP = join(import.meta.dirname, "__test-tmp__");

const createLocalGitRepo = () => {
  mkdirSync(TEST_TMP, { recursive: true });
  const dir = mkdtempSync(join(TEST_TMP, "auto-start-"));
  execSync("git init", { cwd: dir, stdio: "pipe" });
  execSync('git config user.email "test@test.com"', { cwd: dir, stdio: "pipe" });
  execSync('git config user.name "Test"', { cwd: dir, stdio: "pipe" });
  return dir;
};

const isReachable = async (url: string) => {
  try {
    const res = await fetch(`${url}/healthz`);
    return res.ok;
  } catch {
    return false;
  }
};

describe("ensureApi auto-start", () => {
  const dirs: string[] = [];
  let portToCleanup: number | null = null;

  afterEach(async () => {
    for (const dir of dirs) {
      rmSync(dir, { recursive: true, force: true });
    }
    dirs.length = 0;

    if (portToCleanup) {
      runPstdioSafe("close", process.cwd(), {});
      portToCleanup = null;
    }
  });

  test(
    "auto-starts API and runs projects create",
    async () => {
      const port = await getFreePort();
      const url = `http://localhost:${port}`;
      portToCleanup = port;

      expect(await isReachable(url)).toBe(false);

      const repo = createLocalGitRepo();
      dirs.push(repo);

      const storagePath = mkdtempSync(join(tmpdir(), "pstdio-e2e-autostart-storage-"));
      dirs.push(storagePath);

      const output = runPstdio("projects create auto-test", repo, {
        PSTDIO_API_URL: url,
        PSTDIO_API_PORT: String(port),
        PSTDIO_DB_PATH: ":memory:",
        PSTDIO_STORAGE_PATH: storagePath,
        PSTDIO_DISABLE_API_AUTO_START: "0",
        PSTDIO_DEFAULT_EXTENSIONS: "[]",
        PSTDIO_LOG_LEVEL: "info",
      });

      expect(output).toContain("Created project");
      expect(output).toContain("auto-test");

      // Request logging happens after the launcher has exited. A detached API must
      // remain alive when it writes those later records.
      for (let request = 0; request < 3; request += 1) {
        expect(await isReachable(url)).toBe(true);
        await Bun.sleep(50);
      }
    },
    TEST_TIMEOUT,
  );

  test(
    "fails when auto-start is disabled",
    async () => {
      const port = await getFreePort();
      const url = `http://localhost:${port}`;

      const repo = createLocalGitRepo();
      dirs.push(repo);

      const result = runPstdioSafe("projects create no-start", repo, {
        PSTDIO_API_URL: url,
        PSTDIO_API_PORT: String(port),
        PSTDIO_DISABLE_API_AUTO_START: "1",
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Could not start");
    },
    TEST_TIMEOUT,
  );
});
