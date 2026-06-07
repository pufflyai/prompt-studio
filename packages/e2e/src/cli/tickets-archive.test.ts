import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
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

      const { shorthand } = JSON.parse(run('tickets create --content "Archive me"', repo));

      const archived = JSON.parse(run(`tickets archive --id ${shorthand}`, repo));

      expect(archived.shorthand).toBe(shorthand);
      expect(archived.archived).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "archived ticket is hidden by default and included with --archived flag",
    () => {
      const repo = createInitializedRepo("tk-archive-visible");

      const { shorthand } = JSON.parse(run('tickets create --content "Visible archived"', repo));

      run(`tickets archive --id ${shorthand}`, repo);

      const byDefault = JSON.parse(run("tickets list", repo));
      expect(byDefault.map((ticket: { title: string }) => ticket.title)).not.toContain("Visible archived");

      const tickets = JSON.parse(run("tickets list --archived", repo));
      expect(tickets.map((ticket: { title: string }) => ticket.title)).toContain("Visible archived");
    },
    TEST_TIMEOUT,
  );

  test(
    "--archived lists only archived tickets",
    () => {
      const repo = createInitializedRepo("tk-archive-active");

      run('tickets create --content "Active ticket"', repo);
      const { shorthand } = JSON.parse(run('tickets create --content "Archived ticket"', repo));
      run(`tickets archive --id ${shorthand}`, repo);

      const archivedOnly = JSON.parse(run("tickets list --archived", repo));
      expect(archivedOnly.map((ticket: { title: string }) => ticket.title)).toEqual(["Archived ticket"]);
    },
    TEST_TIMEOUT,
  );

  test(
    "returns null when archiving a nonexistent ticket",
    () => {
      const repo = createInitializedRepo("tk-archive-missing");

      const output = JSON.parse(run("tickets archive --id MISSING-99", repo));

      expect(output).toBeNull();
    },
    TEST_TIMEOUT,
  );

  test(
    "archiving an already-archived ticket stays archived",
    () => {
      const repo = createInitializedRepo("tk-archive-twice");

      const { shorthand } = JSON.parse(run('tickets create --content "Double archive"', repo));

      run(`tickets archive --id ${shorthand}`, repo);
      const archived = JSON.parse(run(`tickets archive --id ${shorthand}`, repo));

      expect(archived.archived).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
