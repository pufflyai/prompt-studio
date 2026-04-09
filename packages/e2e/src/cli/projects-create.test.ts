import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { cleanupDirs, createGitRepo, createTempDir, runPstdio, runPstdioSafe } from "./helpers";
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

describe("pstdio projects create", () => {
  test(
    "creates project, writes config, and installs skills",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      // Configure an agent so skills get installed
      run("agents setup claude-code", repo);

      const output = run("projects create my-project", repo);

      expect(output).toContain("Created project");
      expect(output).toContain("my-project");

      const config = JSON.parse(readFileSync(join(repo, ".pstdio", "config.json"), "utf8"));
      expect(config.project_id).toBeTruthy();

      // When creating from inside a git repo, scaffolding is delegated to the API
      const res = execSync(`curl -s ${api.url}/v1/projects/${config.project_id}`, { encoding: "utf8" });
      const project = JSON.parse(res);
      expect(project.name).toBe("my-project");
    },
    TEST_TIMEOUT,
  );

  test(
    "defaults name to git root folder name",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const output = run("projects create", repo);
      const expectedName = basename(repo);

      expect(output).toContain("Created project");
      expect(output).toContain(expectedName);
    },
    TEST_TIMEOUT,
  );

  test(
    "works outside a git repo",
    () => {
      const dir = createTempDir();
      dirs.push(dir);

      const output = run("projects create my-project", dir);

      expect(output).toContain("Created project");
      expect(output).toContain("my-project");

      const config = JSON.parse(readFileSync(join(dir, ".pstdio", "config.json"), "utf8"));
      expect(config.project_id).toBeTruthy();
    },
    TEST_TIMEOUT,
  );

  test(
    "writes config at git root when run from a subdirectory",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const subdir = join(repo, "packages", "cli");
      execSync(`mkdir -p ${subdir}`);

      const output = run("projects create sub-project", subdir);

      expect(output).toContain("Created project");
      expect(output).toContain(repo);

      // Config must be at the git root, not the subdirectory
      expect(existsSync(join(repo, ".pstdio", "config.json"))).toBe(true);
      expect(existsSync(join(subdir, ".pstdio", "config.json"))).toBe(false);
    },
    TEST_TIMEOUT,
  );

  test(
    "fails when already initialized",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      run("projects create first-project", repo);

      const result = runSafe("projects create second-project", repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("already initialized");
    },
    TEST_TIMEOUT,
  );
});
