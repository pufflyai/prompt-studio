import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

const readProjectId = (repo: string) => {
  const configPath = join(repo, ".pstdio", "config.json");
  return (JSON.parse(readFileSync(configPath, "utf8")) as { project_id: string }).project_id;
};

const createPlannerTicket = async (
  projectId: string,
  input: { shorthand: string; content: string; title?: string },
) => {
  const res = await fetch(
    `${api.url}/v1/projects/${projectId}/extension-commands/pstdio.planner.createTicket/execute`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ params: input }),
    },
  );

  if (res.status !== 200) {
    throw new Error(`Planner ticket create failed: ${res.status} ${await res.text()}`);
  }

  return (await res.json()) as { result: { id: string; shorthand: string; title: string; content: string } };
};

const listPlannerTickets = async (projectId: string) => {
  const res = await fetch(`${api.url}/v1/projects/${projectId}/extensions/pstdio.planner/collections/tickets`);
  expect(res.status).toBe(200);
  const body = (await res.json()) as {
    items: Array<{ item_id: string; value_json: { shorthand: string; displayTitle?: string } }>;
  };
  return body.items;
};

describe("planner-owned ticket storage", () => {
  test(
    "creates tickets through the planner extension command and exposes collection rows",
    async () => {
      const repo = createInitializedRepo("planner-ticket-storage");
      const projectId = readProjectId(repo);

      const created = await createPlannerTicket(projectId, {
        shorthand: "PS-1",
        title: "Build login page",
        content: "# Build login page\n\nImplement OAuth flow.",
      });

      expect(created.result.shorthand).toBe("PS-1");

      const rows = await listPlannerTickets(projectId);
      expect(rows).toHaveLength(1);
      expect(rows[0].item_id).toBe(created.result.id);
      expect(rows[0].value_json.displayTitle).toBe("Build login page");
    },
    TEST_TIMEOUT,
  );

  test(
    "pulls planner-owned ticket content into local artifacts",
    async () => {
      const repo = createInitializedRepo("planner-ticket-pull");
      const projectId = readProjectId(repo);

      await createPlannerTicket(projectId, {
        shorthand: "PS-2",
        content: "# Downloadable ticket\n\nWith body.",
      });

      const output = run("tickets pull --ticket_id PS-2", repo);
      expect(output).toContain("Pulled ticket PS-2");
      expect(readFileSync(join(repo, ".pstdio", "tickets", "PS-2", "ticket.md"), "utf8")).toContain(
        "# Downloadable ticket",
      );
    },
    TEST_TIMEOUT,
  );
});
