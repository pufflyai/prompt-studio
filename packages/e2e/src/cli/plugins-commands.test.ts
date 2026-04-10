import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createProjectViaApi, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const dirs: string[] = [];

beforeAll(async () => {
  api = await startApi();
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) => runPstdio(args, cwd, { PSTDIO_API_URL: api.url });

describe("pstdio plugins commands", () => {
  test(
    "lists registered plugins for a linked repo",
    async () => {
      const project = await createProjectViaApi(api.url, "plugins-linked-project");
      const repo = createGitRepo();
      dirs.push(repo);

      run(`projects link --project-id ${project.id}`, repo);
      mkdirSync(join(repo, ".pstdio", "plugins"), { recursive: true });
      writeFileSync(join(repo, ".pstdio", "plugins", "custom-plugin.ts"), `export default { hooks: {} };`);

      const output = run("plugins list", repo);

      expect(output).toContain("Plugins directory:");
      expect(output).toContain("custom-plugin");
      expect(output).toContain(".pstdio/plugins");
    },
    TEST_TIMEOUT,
  );

  test(
    "forces plugin registration for a linked repo",
    async () => {
      const project = await createProjectViaApi(api.url, "plugins-register-project");
      const repo = createGitRepo();
      dirs.push(repo);

      run(`projects link --project-id ${project.id}`, repo);
      run("plugins list", repo);
      mkdirSync(join(repo, ".pstdio", "plugins"), { recursive: true });
      writeFileSync(join(repo, ".pstdio", "plugins", "custom-plugin.ts"), `export default { hooks: {} };`);

      const output = run("plugins register", repo);

      expect(output).toContain("Plugins directory:");
      expect(output).toContain("custom-plugin");
      expect(existsSync(join(repo, ".pstdio", "plugins", "custom-plugin.ts"))).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
