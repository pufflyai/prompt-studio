import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
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

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  run(`projects create ${name}`, repo);
  return repo;
};

describe("pstdio projects startup-script", () => {
  test(
    "set stores script from file",
    () => {
      const repo = createInitializedRepo("ss-set");
      const scriptPath = join(repo, "setup.sh");
      writeFileSync(scriptPath, "#!/bin/bash\necho hello");

      const output = run(`projects startup-script set --file ${scriptPath}`, repo);

      expect(output).toContain("Startup script set for project");
    },
    TEST_TIMEOUT,
  );

  test(
    "get prints stored script",
    () => {
      const repo = createInitializedRepo("ss-get");
      const scriptPath = join(repo, "setup.sh");
      writeFileSync(scriptPath, "#!/bin/bash\necho hello");

      run(`projects startup-script set --file ${scriptPath}`, repo);

      const output = run("projects startup-script get", repo);

      expect(output).toContain("#!/bin/bash");
      expect(output).toContain("echo hello");
    },
    TEST_TIMEOUT,
  );

  test(
    "get shows message when no script configured",
    () => {
      const repo = createInitializedRepo("ss-get-empty");

      const output = run("projects startup-script get", repo);

      expect(output).toContain("No startup script configured");
    },
    TEST_TIMEOUT,
  );

  test(
    "clear removes the startup script",
    () => {
      const repo = createInitializedRepo("ss-clear");
      const scriptPath = join(repo, "setup.sh");
      writeFileSync(scriptPath, "#!/bin/bash\necho hello");

      run(`projects startup-script set --file ${scriptPath}`, repo);
      const clearOutput = run("projects startup-script clear", repo);

      expect(clearOutput).toContain("Startup script cleared for project");

      const getOutput = run("projects startup-script get", repo);
      expect(getOutput).toContain("No startup script configured");
    },
    TEST_TIMEOUT,
  );

  test(
    "full lifecycle: set → get → clear → get",
    () => {
      const repo = createInitializedRepo("ss-lifecycle");
      const scriptPath = join(repo, "init.sh");
      writeFileSync(scriptPath, "bun install");

      run(`projects startup-script set --file ${scriptPath}`, repo);

      const getOutput1 = run("projects startup-script get", repo);
      expect(getOutput1).toContain("bun install");

      run("projects startup-script clear", repo);

      const getOutput2 = run("projects startup-script get", repo);
      expect(getOutput2).toContain("No startup script configured");
    },
    TEST_TIMEOUT,
  );

  test(
    "set fails outside a pstdio project",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);
      const scriptPath = join(repo, "setup.sh");
      writeFileSync(scriptPath, "echo hi");

      const result = runSafe(`projects startup-script set --file ${scriptPath}`, repo);

      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );
});
