import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupDirs, createGitRepo } from "../cli/helpers";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "../cli/timeouts";
import { buildBinary, runPackagedAsync, runPackagedSafe } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;

let homePath: string;

beforeAll(async () => {
  buildBinary();
  homePath = mkdtempSync(join(tmpdir(), "pstdio-packaged-lifecycle-home-"));
  dirs.push(homePath);
}, BUILD_TIMEOUT + SETUP_TIMEOUT);

afterAll(async () => {
  cleanupDirs(dirs);
});

const dirs: string[] = [];

// Keep command output asynchronous while the compiled CLI runs.
const run = (args: string[], cwd: string) => runPackagedAsync(args, cwd, { PSTDIO_HOME: homePath });

const runSafe = (args: string, cwd: string) => runPackagedSafe(args, cwd, { PSTDIO_HOME: homePath });

describe("packaged pstdio — project lifecycle", () => {
  test(
    "shows version",
    async () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const output = await run(["--version"], repo);
      expect(output.trim()).toMatch(/\d+\.\d+\.\d+/);
    },
    TEST_TIMEOUT,
  );
});

describe("packaged pstdio — error cases", () => {
  test(
    "fails outside a project",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const result = runSafe("tickets list", repo);
      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );
});
