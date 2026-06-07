import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { cleanupDirs, createGitRepo } from "../cli/helpers";
import { type ApiInstance, startApi } from "../cli/start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "../cli/timeouts";
import { buildBinary, runPackaged, runPackagedSafe } from "./packaged-helpers";

const BUILD_TIMEOUT = 180_000;

let api: ApiInstance;

beforeAll(async () => {
  buildBinary();
  api = await startApi();
}, BUILD_TIMEOUT + SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

const dirs: string[] = [];

afterEach(() => {
  cleanupDirs(dirs);
});

const run = (args: string, cwd: string) => runPackaged(args, cwd, { PSTDIO_API_URL: api.url });

const runSafe = (args: string, cwd: string) => runPackagedSafe(args, cwd, { PSTDIO_API_URL: api.url });

const createInitializedRepo = (name: string) => {
  const repo = createGitRepo();
  dirs.push(repo);
  run(`projects create ${name}`, repo);
  return repo;
};

describe("packaged pstdio — project lifecycle", () => {
  test(
    "creates a project and lists it",
    async () => {
      const repo = createInitializedRepo("pkg-project");

      const list = run("projects list", repo);
      expect(list).toContain("pkg-project");
    },
    TEST_TIMEOUT,
  );

  test(
    "shows version",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const output = run("--version", repo);
      expect(output.trim()).toMatch(/\d+\.\d+\.\d+/);
    },
    TEST_TIMEOUT,
  );
});

describe("packaged pstdio — tickets", () => {
  test(
    "creates and lists a ticket",
    () => {
      const repo = createInitializedRepo("pkg-tickets");

      const created = JSON.parse(run('tickets create --content "Packaged test ticket"', repo));
      expect(created.shorthand).toMatch(/^T-\d+$/);
      expect(created.title).toBe("Packaged test ticket");

      const tickets = JSON.parse(run("tickets list", repo));
      expect(tickets.map((ticket: { title: string }) => ticket.title)).toContain("Packaged test ticket");
    },
    TEST_TIMEOUT,
  );
});

describe("packaged pstdio — error cases", () => {
  test(
    "fails outside a project",
    () => {
      const repo = createGitRepo();
      dirs.push(repo);

      const result = runSafe("templates list", repo);
      expect(result.exitCode).not.toBe(0);
    },
    TEST_TIMEOUT,
  );
});
