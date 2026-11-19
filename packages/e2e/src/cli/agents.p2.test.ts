import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { e2eExtensions } from "../default-extensions";
import { enableCorePlannerExtension, enableCoreSkillsExtension } from "./extension-helpers";
import { cleanupDirs, createGitRepo, createTempDir, runPstdioAsync } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi({
    env: { PSTDIO_DEFAULT_EXTENSIONS: e2eExtensions("harness-claude-code", "harness-open-code") },
  });
}, SETUP_TIMEOUT);

afterAll(async () => {
  await api?.stop();
});

describe("pstdio agents (harness listing)", () => {
  // Run in a temp git repo so `agents setup` doesn't install skills into the real project
  let repo: string;
  const apiDirs: string[] = [];

  beforeAll(async () => {
    repo = createGitRepo();
    apiDirs.push(repo);
    // Harnesses are contributed by extensions, which are seeded on first project create.
    await runPstdioAsync(["projects", "create", "agents-e2e"], repo, { PSTDIO_API_URL: api.url }, SETUP_TIMEOUT);
  });

  afterAll(() => {
    cleanupDirs(apiDirs);
  });

  const run = (args: string[]) => runPstdioAsync(args, repo, { PSTDIO_API_URL: api.url });

  test(
    "lists installed harnesses",
    async () => {
      const output = await run(["agents", "list"]);

      expect(output).toContain("Claude Code");
      expect(output).toContain("OpenCode");
      expect(output).toContain("pstdio.harness-open-code.harness.opencode");
    },
    TEST_TIMEOUT,
  );

  test(
    "setup resolves the bare agent id to its harness",
    async () => {
      const output = await run(["agents", "setup", "opencode"]);

      expect(output).toContain('Using harness "pstdio.harness-open-code.harness.opencode"');
    },
    TEST_TIMEOUT,
  );

  test(
    "rejects unknown agent for setup",
    async () => {
      await expect(run(["agents", "setup", "unknown-agent"])).rejects.toThrow(
        "No installed harness found for agent: unknown-agent",
      );
    },
    TEST_TIMEOUT,
  );
});

describe("pstdio agents (filesystem)", () => {
  const dirs: string[] = [];
  const run = (args: string[], cwd: string) => runPstdioAsync(args, cwd, { PSTDIO_API_URL: api.url });
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
      await run(["projects", "create", "e2e-agents-test"], repo);
      await enableCoreSkillsExtension(api.url, readProjectId(repo));
      await enableCorePlannerExtension(api.url, readProjectId(repo));
      await run(["agents", "setup", "claude-code"], repo);

      // Skills are installed either during project creation (via registerRepo) or agent setup
      expect(existsSync(join(repo, ".claude", "skills", "pstdio", "SKILL.md"))).toBe(true);
      expect(existsSync(join(repo, ".claude", "skills", "create-ticket", "SKILL.md"))).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "keeps existing skill folders until --force replaces them",
    async () => {
      const repo = createGitRepo();
      // The global skill folder is outside every workspace, so workspace provisioning never writes there.
      const home = createTempDir();
      dirs.push(repo, home);
      await run(["projects", "create", "e2e-agents-skill-folders"], repo);
      await enableCoreSkillsExtension(api.url, readProjectId(repo));
      const installSkills = (force = false) =>
        runPstdioAsync(
          ["agents", "install-skills", "claude-code", "--global-skills", ...(force ? ["--force"] : [])],
          repo,
          {
            PSTDIO_API_URL: api.url,
            HOME: home,
            USERPROFILE: home,
          },
        );
      const skillFile = join(home, ".claude", "skills", "pstdio", "SKILL.md");

      expect(await installSkills()).toMatch(/Installed \d+ skill\(s\): .*pstdio/);
      const source = readFileSync(skillFile, "utf8");

      writeFileSync(skillFile, "edited");
      const output = await installSkills();
      expect(output).toMatch(/Kept \d+ existing skill folder\(s\) unchanged: .*pstdio/);
      expect(output).toContain("pst agents install-skills claude-code --global-skills --force");
      expect(readFileSync(skillFile, "utf8")).toBe("edited");

      expect(await installSkills(true)).toMatch(/Replaced \d+ skill\(s\): .*pstdio/);
      expect(readFileSync(skillFile, "utf8")).toBe(source);
    },
    TEST_TIMEOUT,
  );

  test(
    "skips skill installation outside a project folder",
    async () => {
      const dir = createTempDir();
      dirs.push(dir);

      const output = await run(["agents", "setup", "claude-code"], dir);

      expect(output).toContain("Not inside a project folder");
    },
    TEST_TIMEOUT,
  );
});
