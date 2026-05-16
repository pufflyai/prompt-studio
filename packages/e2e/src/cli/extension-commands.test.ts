import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
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
const extensionLabPath = join(import.meta.dirname, "../../../../extensions/extension-lab");

describe("pstdio extension commands", () => {
  test(
    "routes namespace commands through API-owned command execution",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      run("projects create extension-command-project", repo);
      run(`extensions add ${extensionLabPath} --name extension-lab --skip-install`, repo);

      const namespaceHelp = run("extension-lab --help", repo);
      expect(namespaceHelp).toContain("extension-lab counter bump");
      expect(namespaceHelp).toContain("pstdio.extension-lab");

      const commandHelp = run("extension-lab counter bump --help", repo);
      expect(commandHelp).toContain("--amount");

      const bump = JSON.parse(run("extension-lab counter bump --amount 2", repo));
      expect(bump.counter).toBe(2);

      const read = JSON.parse(run("extension-lab counter read", repo));
      expect(read.counter).toBe(2);
    },
    TEST_TIMEOUT,
  );
});
