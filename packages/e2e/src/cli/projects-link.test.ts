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

describe("pstdio projects link", () => {
  test(
    "links existing project and registers repo",
    async () => {
      const project = await createProjectViaApi(api.url, "link-test");
      const repo = createGitRepo();
      dirs.push(repo);

      const output = run(`projects link --project-id ${project.id}`, repo);

      expect(output).toContain("Linked project");
      expect(output).toContain("link-test");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails when project does not exist",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const result = runSafe("projects link --project-id nonexistent-uuid", repo);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Project not found");
    },
    TEST_TIMEOUT,
  );

  test(
    "installs skills for configured agents",
    async () => {
      const repo = createGitRepo();
      dirs.push(repo);

      run("agents setup claude-code", repo);

      const project = await createProjectViaApi(api.url, "link-skills-test");
      const output = run(`projects link --project-id ${project.id}`, repo);

      expect(output).toContain("Linked project");
      expect(existsSync(join(repo, ".claude", "skills", "create-ticket", "SKILL.md"))).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "fails outside a git repo",
    async () => {
      const project = await createProjectViaApi(api.url, "no-git-link");
      const dir = createTempDir();
      dirs.push(dir);

      const result = runSafe(`projects link --project-id ${project.id}`, dir);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Not inside a git repository");
    },
    TEST_TIMEOUT,
  );
});
