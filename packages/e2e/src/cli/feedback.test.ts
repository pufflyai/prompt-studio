import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { createTempDir, PSTDIO_CLI, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: "[]" } });
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const runPstdioCaptured = (args: string, env: Record<string, string>) => {
  const result = spawnSync("bun", ["run", PSTDIO_CLI, ...args.split(" ")], {
    cwd: process.cwd(),
    env: { ...process.env, PSTDIO_DISABLE_EMBED_MANIFEST: "1", PSTDIO_DISABLE_API_AUTO_START: "1", ...env },
    encoding: "utf8",
    timeout: TEST_TIMEOUT,
  });

  return {
    exitCode: result.status ?? 1,
    output: `${result.stdout ?? ""}${result.stderr ?? ""}`,
  };
};

describe("cli help and feedback", () => {
  test(
    "shows agents help when subcommand is missing",
    () => {
      const result = runPstdioCaptured("agents", { PSTDIO_API_URL: api.url });
      const { output } = result;

      expect(result.exitCode).toBe(0);
      expect(output).toContain("pstdio agents [command]");
      expect(output).toContain("Manage coding agents");
      expect(output).toContain("pstdio agents list");
    },
    TEST_TIMEOUT,
  );

  test(
    "shows projects help when subcommand is missing",
    () => {
      const result = runPstdioCaptured("projects", { PSTDIO_API_URL: api.url });
      const { output } = result;

      expect(result.exitCode).toBe(0);
      expect(output).toContain("pstdio projects [command]");
      expect(output).toContain("Manage projects");
      expect(output).toContain("pstdio projects list");
    },
    TEST_TIMEOUT,
  );

  test(
    "prints error and root help for unknown command",
    () => {
      const result = runPstdioSafe("foo", createTempDir(), {
        PSTDIO_DISABLE_API_AUTO_START: "1",
      });

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Unknown argument: foo");
    },
    TEST_TIMEOUT,
  );
});
