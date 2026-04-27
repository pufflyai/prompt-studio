import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createTempDir, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi({ agents: "fake,claude-code,opencode" });
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

describe("pstdio harnesses (API state)", () => {
  // Run in a temp git repo so commands never touch the real project.
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
    "lists known harness providers with none configured",
    () => {
      const output = run("harnesses list");

      expect(output).toContain("Claude Code");
      expect(output).toContain("OpenCode");
    },
    TEST_TIMEOUT,
  );

  test(
    "configures a known harness provider as default",
    () => {
      const output = run("harnesses setup opencode");

      expect(output).toContain('Harness "pstdio.harness.opencode" configured');
      expect(output).toContain("(default)");
    },
    TEST_TIMEOUT,
  );

  test(
    "configures a second harness provider without default",
    () => {
      const output = run("harnesses setup claude-code");

      expect(output).toContain('Harness "pstdio.harness.claude-code" configured');
      expect(output).not.toContain("(default)");
    },
    TEST_TIMEOUT,
  );

  test(
    "lists harness providers with configured and default markers",
    () => {
      const output = run("harnesses list");

      expect(output).toContain("yes");
      expect(output).toContain("Default");
    },
    TEST_TIMEOUT,
  );

  test(
    "rejects unknown harness provider for setup",
    () => {
      const result = runSafe("harnesses setup unknown-agent");

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Harness not found: pstdio.harness.unknown-agent");
    },
    TEST_TIMEOUT,
  );

  test(
    "removes a configured harness provider",
    () => {
      const output = run("harnesses remove opencode");

      expect(output).toContain('Harness "pstdio.harness.opencode" removed.');
    },
    TEST_TIMEOUT,
  );

  test(
    "rejects unknown harness provider for remove",
    () => {
      const result = runSafe("harnesses remove unknown-agent");

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Harness not found: pstdio.harness.unknown-agent");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails to remove unconfigured harness provider",
    () => {
      const result = runSafe("harnesses remove opencode");

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Harness not found: pstdio.harness.opencode");
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio harnesses (filesystem)", () => {
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

      run("harnesses setup claude-code", repo);

      // Initialize a project so skills can be fetched from the API
      run("projects create e2e-harnesses-test", repo);

      // Skills are installed during project creation via registerRepo.
      expect(existsSync(join(repo, ".claude", "skills", "create-ticket", "SKILL.md"))).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "configures outside a git repo without installing local skills",
    () => {
      const dir = createTempDir();
      dirs.push(dir);

      const output = run("harnesses setup claude-code", dir);

      expect(output).toContain('Harness "pstdio.harness.claude-code" configured');
      expect(existsSync(join(dir, ".claude", "skills", "create-ticket", "SKILL.md"))).toBe(false);
    },
    TEST_TIMEOUT,
  );

  test(
    "removes harness configuration without deleting local skills",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      run("harnesses setup claude-code", repo);
      run("projects create e2e-harnesses-delete-test", repo);
      expect(existsSync(join(repo, ".claude", "skills", "create-ticket", "SKILL.md"))).toBe(true);

      const output = run("harnesses remove claude-code", repo);

      expect(output).toContain('Harness "pstdio.harness.claude-code" removed.');
      expect(existsSync(join(repo, ".claude", "skills", "create-ticket", "SKILL.md"))).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "removes skills with --delete-skills",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      run("harnesses setup claude-code", repo);
      run("projects create e2e-harnesses-delete-skills-test", repo);
      expect(existsSync(join(repo, ".claude", "skills", "create-ticket", "SKILL.md"))).toBe(true);

      const output = run("harnesses remove claude-code --delete-skills", repo);

      expect(output).toContain("Deleted");
      expect(existsSync(join(repo, ".claude", "skills", "create-ticket"))).toBe(false);
    },
    TEST_TIMEOUT,
  );
});
