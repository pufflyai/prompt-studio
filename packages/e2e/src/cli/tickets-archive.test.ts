import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
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

describe("pstdio tickets archive", () => {
  test(
    "archives a ticket",
    () => {
      const repo = createInitializedRepo("tk-archive");

      const createOutput = run('tickets create --content "Archive me"', repo);
      const shorthand = createOutput.match(/Created ticket (\S+)/)![1];

      const output = run(`tickets archive --id ${shorthand}`, repo);

      expect(output).toContain(`Archived ticket ${shorthand}`);
    },
    TEST_TIMEOUT,
  );

  test(
    "archived ticket is excluded from list by default",
    () => {
      const repo = createInitializedRepo("tk-archive-list");

      const createOutput = run('tickets create --content "Hidden ticket"', repo);
      const shorthand = createOutput.match(/Created ticket (\S+)/)![1];

      run(`tickets archive --id ${shorthand}`, repo);

      const listOutput = run("tickets list", repo);
      expect(listOutput).not.toContain("Hidden ticket");
    },
    TEST_TIMEOUT,
  );

  test(
    "archived ticket visible with --archived flag",
    () => {
      const repo = createInitializedRepo("tk-archive-visible");

      const createOutput = run('tickets create --content "Visible archived"', repo);
      const shorthand = createOutput.match(/Created ticket (\S+)/)![1];

      run(`tickets archive --id ${shorthand}`, repo);

      const listOutput = run("tickets list --archived", repo);
      expect(listOutput).toContain("Visible archived");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails for nonexistent ticket",
    () => {
      const repo = createInitializedRepo("tk-archive-missing");

      const result = runSafe("tickets archive --id MISSING-99", repo);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Ticket not found");
    },
    TEST_TIMEOUT,
  );

  test(
    "fails when archiving an already-archived ticket",
    () => {
      const repo = createInitializedRepo("tk-archive-twice");

      const createOutput = run('tickets create --content "Double archive"', repo);
      const shorthand = createOutput.match(/Created ticket (\S+)/)![1];

      run(`tickets archive --id ${shorthand}`, repo);

      const result = runSafe(`tickets archive --id ${shorthand}`, repo);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Ticket already archived");
    },
    TEST_TIMEOUT,
  );
});
