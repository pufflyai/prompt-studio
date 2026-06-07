import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
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

      const { shorthand } = JSON.parse(run('tickets create --content "Delete me"', repo));

      const result = JSON.parse(run(`tickets delete --id ${shorthand}`, repo));

      expect(result.deleted).toBe(true);
    },
    TEST_TIMEOUT,
  );

  test(
    "deleted ticket no longer appears in list",
    () => {
      const repo = createInitializedRepo("tk-delete-list");

      const { shorthand } = JSON.parse(run('tickets create --content "Gone ticket"', repo));

      run(`tickets delete --id ${shorthand}`, repo);

      const tickets = JSON.parse(run("tickets list", repo));
      expect(tickets.map((ticket: { title: string }) => ticket.title)).not.toContain("Gone ticket");
    },
    TEST_TIMEOUT,
  );

  test(
    "deletes a saved ticket by shorthand",
    () => {
      const repo = createInitializedRepo("tk-delete-local");

      const { shorthand } = JSON.parse(run('tickets write --title "Local delete"', repo));

      run(`tickets save --id ${shorthand}`, repo);

      const ticketDir = findTicketDir(repo, shorthand);
      expect(ticketDir).not.toBeNull();
      expect(existsSync(ticketDir!)).toBe(true);

      const result = JSON.parse(run(`tickets delete --id ${shorthand}`, repo));
      expect(result.deleted).toBe(true);

      const tickets = JSON.parse(run("tickets list --draft", repo));
      expect(tickets.map((ticket: { shorthand: string }) => ticket.shorthand)).not.toContain(shorthand);
    },
    TEST_TIMEOUT,
  );

  test(
    "is idempotent for a nonexistent ticket",
    () => {
      const repo = createInitializedRepo("tk-delete-missing");

      const result = JSON.parse(run("tickets delete --id MISSING-99", repo));

      expect(result.deleted).toBe(true);
    },
    TEST_TIMEOUT,
  );
});
