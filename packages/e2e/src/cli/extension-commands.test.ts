import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createTempDir, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
let cliHome = "";
const dirs: string[] = [];

beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: "[]" } });
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

beforeEach(() => {
  cliHome = createTempDir();
  dirs.push(cliHome);
});

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) =>
  runPstdio(args, cwd, { PSTDIO_API_URL: api.url, PSTDIO_DEFAULT_EXTENSIONS: "[]", PSTDIO_HOME: cliHome });
const extensionLabPath = join(import.meta.dirname, "../../../../packages/workbench-fixture");

describe("pstdio extension commands", () => {
  test(
    "routes namespace commands through API-owned command execution",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      run("projects create extension-command-project", repo);
      run(`extensions add ${extensionLabPath} --name workbench-fixture --skip-install`, repo);

      const rootHelp = run("--help", repo);
      expect(rootHelp).toContain("workbench-fixture [command]");

      const namespaceHelp = run("workbench-fixture --help", repo);
      // Namespace help mirrors the yargs command-group layout: scriptName-prefixed
      // paths under a Commands section, plus an Options section.
      expect(namespaceHelp).toContain("Commands:");
      expect(namespaceHelp).toContain("pstdio workbench-fixture counter bump");
      expect(namespaceHelp).toContain("Options:");

      const commandHelp = run("workbench-fixture counter bump --help", repo);
      expect(commandHelp).toContain("--amount");

      const bump = JSON.parse(run("workbench-fixture counter bump --amount 2", repo));
      expect(bump.counter).toBe(2);

      const read = JSON.parse(run("workbench-fixture counter read", repo));
      expect(read.counter).toBe(2);
    },
    TEST_TIMEOUT,
  );
});
