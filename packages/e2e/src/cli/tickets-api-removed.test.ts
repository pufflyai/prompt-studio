import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { PSTDIO_E2E_PLANNER_EXTENSION } from "../default-extensions";
import { cleanupDirs, createGitRepo, runPstdio } from "./helpers";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;

beforeAll(async () => {
  api = await startApi({ env: { PSTDIO_DEFAULT_EXTENSIONS: PSTDIO_E2E_PLANNER_EXTENSION } });
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

describe("legacy ticket API removal", () => {
  test(
    "core /v1/tickets no longer creates tickets",
    async () => {
      createInitializedRepo("tk-api-removed");

      const res = await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: "project-1", content: "# Backend ticket" }),
      });

      expect(res.status).toBe(404);
    },
    TEST_TIMEOUT,
  );

  test(
    "planner CLI tickets still create and list extension-owned tickets",
    () => {
      const repo = createInitializedRepo("tk-extension-visible");

      run('tickets create --content "Visible ticket"', repo);

      const tickets = JSON.parse(run("tickets list", repo));
      expect(tickets.map((ticket: { title: string }) => ticket.title)).toContain("Visible ticket");
    },
    TEST_TIMEOUT,
  );
});
