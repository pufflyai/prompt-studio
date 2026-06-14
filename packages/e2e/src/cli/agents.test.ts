import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { enableCoreSkillsExtension } from "./extension-helpers";
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

describe("pstdio agents (harness listing)", () => {
  // Run in a temp git repo so `agents setup` doesn't install skills into the real project
  let repo: string;
  const apiDirs: string[] = [];

  beforeAll(() => {
    repo = createGitRepo();
    apiDirs.push(repo);
    // Harnesses are contributed by extensions, which are seeded on first project create.
    runPstdio("projects create agents-e2e", repo, { PSTDIO_API_URL: api.url }, SETUP_TIMEOUT);
  });

  afterAll(() => {
    cleanupDirs(apiDirs);
  });

  const run = (args: string) => runPstdio(args, repo, { PSTDIO_API_URL: api.url });
  const runSafe = (args: string) => runPstdioSafe(args, repo, { PSTDIO_API_URL: api.url });

  test(
    "lists installed harnesses",
    () => {
      const output = run("agents list");

      expect(output).toContain("Claude Code");
      expect(output).toContain("OpenCode");
      expect(output).toContain("pstdio.harness-open-code.opencode");
    },
    TEST_TIMEOUT,
  );

  test(
    "setup resolves the bare agent id to its harness",
    () => {
      const output = run("agents setup opencode");

      expect(output).toContain('Using harness "pstdio.harness-open-code.opencode"');
    },
    TEST_TIMEOUT,
  );

  test(
    "rejects unknown agent for setup",
    () => {
      const result = runSafe("agents setup unknown-agent");

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("No installed harness found for agent: unknown-agent");
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio agents (filesystem)", () => {
  const dirs: string[] = [];
  const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });
  const readProjectId = (repo: string) => {
    const config = JSON.parse(readFileSync(join(repo, ".pstdio", "config.json"), "utf8")) as { project_id: string };
    return config.project_id;
  };

  afterEach(() => {
    cleanupDirs(dirs);
  });

  test(
    "installs skills in a linked project repo",
    async () => {
      const repo = createGitRepo();
      dirs.push(repo);

      // Initialize a project so skills can be fetched from the API
      run("projects create e2e-agents-test", repo);
      await enableCoreSkillsExtension(api.url, readProjectId(repo));
      run("agents setup claude-code", repo);

      // Skills are installed either during project creation (via registerRepo) or agent setup
      expect(existsSync(join(repo, ".claude", "skills", "pstdio", "SKILL.md"))).toBe(true);
      expect(existsSync(join(repo, ".claude", "skills", "create-ticket", "SKILL.md"))).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "skips skill installation outside a git repo",
    () => {
      const dir = createTempDir();
      dirs.push(dir);

      const output = run("agents setup claude-code", dir);

      expect(output).toContain("Not inside a git repository");
    },
    TEST_TIMEOUT,
  );
});
