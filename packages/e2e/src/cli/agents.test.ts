import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
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

describe("pstdio agents (API state)", () => {
  // Run in a temp git repo so `agents setup` doesn't install skills into the real project
  let repo: string;
  const apiDirs: string[] = [];

  beforeAll(() => {
    repo = createGitRepo();
    apiDirs.push(repo);
  });

  afterAll(() => {
    cleanupDirs(apiDirs);
  });

  const run = (args: string) => runPstdio(args, repo, { PSTDIO_API_URL: api.url });
  const runSafe = (args: string) => runPstdioSafe(args, repo, { PSTDIO_API_URL: api.url });

  test(
    "lists known agents with none configured",
    () => {
      const output = run("agents list");

      expect(output).toContain("Claude Code");
      expect(output).toContain("OpenCode");
    },
    TEST_TIMEOUT,
  );

  test(
    "configures a known agent as default",
    () => {
      const output = run("agents setup opencode");

      expect(output).toContain('Agent "opencode" configured');
      expect(output).toContain("(default)");
    },
    TEST_TIMEOUT,
  );

  test(
    "configures a second agent without default",
    () => {
      const output = run("agents setup claude-code");

      expect(output).toContain('Agent "claude-code" configured');
      expect(output).not.toContain("(default)");
    },
    TEST_TIMEOUT,
  );

  test(
    "lists agents with configured and default markers",
    () => {
      const output = run("agents list");

      expect(output).toContain("yes");
      expect(output).toContain("Default");
    },
    TEST_TIMEOUT,
  );

  test(
    "rejects unknown agent for setup",
    () => {
      const result = runSafe("agents setup unknown-agent");

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Unknown agent: unknown-agent");
    },
    TEST_TIMEOUT,
  );

  test(
    "removes a configured agent",
    () => {
      const output = run("agents remove opencode");

      expect(output).toContain('Agent "opencode" removed.');
    },
    TEST_TIMEOUT,
  );

  test(
    "rejects unknown agent for remove",
    () => {
      const result = runSafe("agents remove unknown-agent");

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Unknown agent: unknown-agent");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails to remove unconfigured agent",
    () => {
      const result = runSafe("agents remove opencode");

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Agent not found: opencode");
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio agents (filesystem)", () => {
  const dirs: string[] = [];
  const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });

  afterEach(() => {
    cleanupDirs(dirs);
  });

  test(
    "installs skills in a linked project repo",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      // Initialize a project so skills can be fetched from the API
      run("projects create e2e-agents-test", repo);
      run("agents setup claude-code", repo);

      // Skills are installed either during project creation (via registerRepo) or agent setup
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

  test(
    "removes skills with --delete-skills",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      run("projects create e2e-agents-delete-test", repo);
      run("agents setup claude-code", repo);
      expect(existsSync(join(repo, ".claude", "skills", "create-ticket", "SKILL.md"))).toBe(true);

      const output = run("agents remove claude-code --delete-skills", repo);

      expect(output).toContain("Deleted");
      expect(existsSync(join(repo, ".claude", "skills", "create-ticket"))).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
