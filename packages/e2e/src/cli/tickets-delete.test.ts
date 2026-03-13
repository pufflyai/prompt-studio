import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio, runPstdioSafe } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

const findTicketDir = (repo: string, shorthand: string) => {
  const ticketsBase = join(repo, ".pstdio", "tickets");
  const exactDir = join(ticketsBase, shorthand);
  return existsSync(exactDir) ? exactDir : null;
};

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

describe("pstdio tickets delete", () => {
  test(
    "deletes a ticket",
    () => {
      const repo = createInitializedRepo("tk-delete");

      const createOutput = run('tickets create --content "Delete me"', repo);
      const shorthand = createOutput.match(/Created ticket (\S+)/)![1];

      const output = run(`tickets delete --id ${shorthand}`, repo);

      expect(output).toContain(`Deleted ticket ${shorthand}`);
    },
    TEST_TIMEOUT,
  );

  test(
    "deleted ticket no longer appears in list",
    () => {
      const repo = createInitializedRepo("tk-delete-list");

      const createOutput = run('tickets create --content "Gone ticket"', repo);
      const shorthand = createOutput.match(/Created ticket (\S+)/)![1];

      run(`tickets delete --id ${shorthand}`, repo);

      const listOutput = run("tickets list", repo);
      expect(listOutput).not.toContain("Gone ticket");
    },
    TEST_TIMEOUT,
  );

  test(
    "removes local ticket directory",
    () => {
      const repo = createInitializedRepo("tk-delete-local");

      const writeOutput = run('tickets write --title "Local delete"', repo);
      const shorthand = writeOutput.match(/Created ticket (\S+)/)![1];

      run(`tickets save --id ${shorthand}`, repo);

      const ticketDir = findTicketDir(repo, shorthand);
      expect(ticketDir).not.toBeNull();
      expect(existsSync(ticketDir!)).toBe(true);

      run(`tickets delete --id ${shorthand}`, repo);

      expect(findTicketDir(repo, shorthand)).toBeNull();
    },
    TEST_TIMEOUT,
  );

  test(
    "fails for nonexistent ticket",
    () => {
      const repo = createInitializedRepo("tk-delete-missing");

      const result = runSafe("tickets delete --id MISSING-99", repo);

      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("Ticket not found");
    },
    TEST_TIMEOUT,
  );
});
