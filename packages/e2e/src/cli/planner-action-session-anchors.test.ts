import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { cleanupDirs } from "./helpers";
import { createInitializedRepo, createRun, getProjectId, type HookTestContext, registerRepo } from "./hooks-infra";
import { type ApiInstance, startApi } from "./start-api";
import { SETUP_TIMEOUT, TEST_TIMEOUT } from "./timeouts";

let api: ApiInstance;
const ctx: HookTestContext = { api: null!, dirs: [] };

beforeAll(async () => {
  api = await startApi();
  ctx.api = api;
}, SETUP_TIMEOUT);

afterAll(() => {
  api?.stop();
});

afterEach(() => {
  cleanupDirs(ctx.dirs);
});

const executePlannerCommand = async (projectId: string, commandId: string, body: Record<string, unknown>) => {
  const res = await fetch(
    `${api.url}/v1/projects/${encodeURIComponent(projectId)}/extensions/commands/${commandId}/execute`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  expect(res.status).toBe(200);
  return (await res.json()) as { outcome: { ok: boolean; error?: { message: string }; value?: unknown } };
};

const getSession = async (sessionId: string) => {
  const res = await fetch(`${api.url}/v1/sessions/${encodeURIComponent(sessionId)}`);
  expect(res.status).toBe(200);
  return (await res.json()) as { id: string; anchors_json: Array<{ type: string; id: string }> };
};

describe("planner action session anchors", () => {
  test(
    "anchors the Refine ticket session to its ticket",
    async () => {
      const run = createRun(ctx);
      const repo = createInitializedRepo(ctx, "planner-action-anchors");
      const projectId = getProjectId(repo);
      await registerRepo(ctx, projectId, repo, "planner-action-anchors-repo");

      const ticket = JSON.parse(run(`tickets create --content "# Refine anchor proof"`, repo)) as {
        id: string;
        shorthand: string;
      };

      const result = await executePlannerCommand(projectId, "pstdio-planner.refine-ticket", {
        source: "api",
        params: { agent: { harnessId: "pstdio.harness-lab.fake" } },
        resource: {
          type: "ticket",
          id: ticket.id,
          projectId,
          label: ticket.shorthand,
          extensionId: "pstdio.pstdio-planner",
        },
      });

      expect(result.outcome.ok).toBe(true);
      const session = result.outcome.value as { id: string };
      expect(session.id).toBeString();

      const persisted = await getSession(session.id);
      const ticketAnchor = persisted.anchors_json.find((anchor) => anchor.type === "ticket");
      expect(ticketAnchor).toBeDefined();
      expect(ticketAnchor?.id).toBe(ticket.id);
    },
    TEST_TIMEOUT,
  );
});
