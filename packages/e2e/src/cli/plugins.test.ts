import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createProjectViaApi } from "./helpers";
import { configureAgent, type HookTestContext, writePlugin } from "./hooks-infra";
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

const setupProjectWithRepo = async (name: string) => {
  const repo = createGitRepo();
  ctx.dirs.push(repo);

  const project = await createProjectViaApi(api.url, name);
  mkdirSync(join(repo, ".pstdio"), { recursive: true });
  writeFileSync(join(repo, ".pstdio", "config.json"), JSON.stringify({ project_id: project.id }));

  await fetch(`${api.url}/v1/projects/${project.id}/repos`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, path: repo }),
  });

  return { repo, projectId: project.id };
};

describe("plugin actions via API", () => {
  test(
    "lists actions registered by plugins",
    async () => {
      const { repo, projectId } = await setupProjectWithRepo("plugin-actions");

      writePlugin(
        repo,
        "custom-actions.ts",
        `export default {
          actions: [
            { key: "greet", label: "Greet", targetType: "ticket", placement: "primary", trigger() {} },
            { key: "review", label: "Review", targetType: "workspace", placement: "secondary", trigger() {} },
          ],
        };`,
      );

      const res = await fetch(`${api.url}/v1/projects/${projectId}/actions`);
      expect(res.status).toBe(200);

      const actions = await res.json();
      expect(actions).toHaveLength(2);

      const greet = actions.find((a: { key: string }) => a.key === "custom-actions/greet");
      expect(greet).toBeDefined();
      expect(greet.label).toBe("Greet");
      expect(greet.targetType).toBe("ticket");
      expect(greet.placement).toBe("primary");

      const review = actions.find((a: { key: string }) => a.key === "custom-actions/review");
      expect(review).toBeDefined();
      expect(review.targetType).toBe("workspace");
    },
    TEST_TIMEOUT,
  );

  test(
    "filters actions by targetType",
    async () => {
      const { repo, projectId } = await setupProjectWithRepo("plugin-filter");

      writePlugin(
        repo,
        "multi-target.ts",
        `export default {
          actions: [
            { key: "t-action", label: "Ticket action", targetType: "ticket", placement: "primary", trigger() {} },
            { key: "w-action", label: "Workspace action", targetType: "workspace", placement: "secondary", trigger() {} },
          ],
        };`,
      );

      const ticketRes = await fetch(`${api.url}/v1/projects/${projectId}/actions?targetType=ticket`);
      const ticketActions = await ticketRes.json();
      expect(ticketActions).toHaveLength(1);
      expect(ticketActions[0].key).toBe("multi-target/t-action");

      const wsRes = await fetch(`${api.url}/v1/projects/${projectId}/actions?targetType=workspace`);
      const wsActions = await wsRes.json();
      expect(wsActions).toHaveLength(1);
      expect(wsActions[0].key).toBe("multi-target/w-action");
    },
    TEST_TIMEOUT,
  );

  test(
    "executes a plugin action for a ticket target",
    async () => {
      const { repo, projectId } = await setupProjectWithRepo("plugin-exec");
      await configureAgent(ctx);

      writePlugin(
        repo,
        "exec-action.ts",
        `export default {
          actions: [
            {
              key: "noop",
              label: "No-op action",
              targetType: "ticket",
              placement: "overflow",
              async trigger() {},
            },
          ],
        };`,
      );

      const ticketRes = await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, user_prompt: "plugin exec test" }),
      });
      const ticket = (await ticketRes.json()) as { id: string };

      const actionKey = encodeURIComponent("exec-action/noop");
      const res = await fetch(`${api.url}/v1/projects/${projectId}/actions/${actionKey}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_type: "ticket", target_id: ticket.id }),
      });

      expect(res.status).toBe(200);
      const result = await res.json();
      expect(result.status).toBe("success");
    },
    TEST_TIMEOUT,
  );

  test(
    "returns 404 for unknown action key",
    async () => {
      const { projectId } = await setupProjectWithRepo("plugin-404");

      const actionKey = encodeURIComponent("nonexistent/action");
      const res = await fetch(`${api.url}/v1/projects/${projectId}/actions/${actionKey}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_type: "ticket", target_id: "fake-id" }),
      });

      expect(res.status).toBe(404);
    },
    TEST_TIMEOUT,
  );

  test(
    "returns empty actions for project with no plugins",
    async () => {
      const { projectId } = await setupProjectWithRepo("plugin-empty");

      const res = await fetch(`${api.url}/v1/projects/${projectId}/actions`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    },
    TEST_TIMEOUT,
  );
});
