import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { PSTDIO_E2E_PLANNER_EXTENSION } from "../default-extensions";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_PLANNER_EXTENSION } });
}, SETUP_TIMEOUT);

afterAll(async () => {
  await api?.stop();
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

describe("pstdio pstdio.planner delete-ticket", () => {
  test(
    "deleted ticket no longer appears in list",
    () => {
      const repo = createInitializedRepo("tk-delete-list");

      const { id, shorthand } = JSON.parse(run('pstdio.planner create-ticket --content "Gone ticket"', repo));

      const result = JSON.parse(run(`pstdio.planner delete-ticket --id ${shorthand}`, repo));
      expect(result.id).toBe(id);

      const tickets = JSON.parse(run("pstdio.planner list-tickets", repo)).tickets;
      expect(tickets.map((ticket: { title: string }) => ticket.title)).not.toContain("Gone ticket");
    },
    TEST_TIMEOUT,
  );

  test(
    "is idempotent for a nonexistent ticket",
    () => {
      const repo = createInitializedRepo("tk-delete-missing");

      const result = JSON.parse(run("pstdio.planner delete-ticket --id MISSING-99", repo));

      expect(result.id).toBe("MISSING-99");
    },
    TEST_TIMEOUT,
  );
});
