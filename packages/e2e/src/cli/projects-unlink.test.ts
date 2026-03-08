import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createProjectViaApi, createTempDir, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi();
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const dirs: string[] = [];

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });

const runSafe = (args: string, cwd: string) => runPstdioSafe(args, cwd, { PSTDIO_API_URL: api.url });

describe("pstdio projects unlink", () => {
  test(
    "removes config.json from a linked project",
    async () => {
      const project = await createProjectViaApi(api.url, "unlink-test");
      const repo = createGitRepo();
      dirs.push(repo);

      run(`projects link --project-id ${project.id}`, repo);
      expect(existsSync(join(repo, ".pstdio", "config.json"))).toBe(true);

      const output = run("projects unlink", repo);

      expect(output).toContain("Unlinked project");
      expect(existsSync(join(repo, ".pstdio", "config.json"))).toBe(false);
    },
    TEST_TIMEOUT,
  );

  test(
    "fails when no project is linked",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const result = runSafe("projects unlink", repo);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("No project linked");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails outside a git repo",
    () => {
      const dir = createTempDir();
      dirs.push(dir);

      const result = runSafe("projects unlink", dir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Not inside a git repository");
    },
    TEST_TIMEOUT,
  );
});
