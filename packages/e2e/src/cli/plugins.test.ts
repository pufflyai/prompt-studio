import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs, createGitRepo, createProjectViaApi } from "./helpers";
import type { HookTestContext } from "./hooks-infra";
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

const writeExtension = (repo: string, extensionId: string, source: string) => {
  const extensionDir = join(repo, ".pstdio", "extensions", extensionId);
  mkdirSync(extensionDir, { recursive: true });
  writeFileSync(join(extensionDir, "extension.ts"), source);
};

describe("extension command actions via API", () => {
  test(
    "lists actions registered by extension command menus",
    async () => {
      const { repo, projectId } = await setupProjectWithRepo("extension-actions");

      writeExtension(
        repo,
        "custom-actions",
        `export default {
          id: "project.custom-actions",
          name: "Custom Actions",
          commands: {
            greet: {
              title: "Greet",
              target: "ticket",
              menus: [{ slot: "ticket.header.primary" }],
              run() {},
            },
            review: {
              title: "Review",
              target: "workspace",
              menus: [{ slot: "workspace.header.secondary" }],
              run() {},
            },
          },
        };`,
      );

      const res = await fetch(`${api.url}/v1/projects/${projectId}/actions`);
      expect(res.status).toBe(200);

      const actions = await res.json();
      expect(actions).toHaveLength(2);

      const greet = actions.find((a: { key: string }) => a.key === "project.custom-actions.greet");
      expect(greet).toBeDefined();
      expect(greet.label).toBe("Greet");
      expect(greet.targetType).toBe("ticket");
      expect(greet.placement).toBe("primary");

      const review = actions.find((a: { key: string }) => a.key === "project.custom-actions.review");
      expect(review).toBeDefined();
      expect(review.targetType).toBe("workspace");
    },
    TEST_TIMEOUT,
  );

  test(
    "filters actions by targetType",
    async () => {
      const { repo, projectId } = await setupProjectWithRepo("extension-filter");

      writeExtension(
        repo,
        "multi-target",
        `export default {
          id: "project.multi-target",
          name: "Multi Target",
          commands: {
            ticketAction: {
              title: "Ticket action",
              target: "ticket",
              menus: [{ slot: "ticket.header.primary" }],
              run() {},
            },
            workspaceAction: {
              title: "Workspace action",
              target: "workspace",
              menus: [{ slot: "workspace.header.secondary" }],
              run() {},
            },
          },
        };`,
      );

      const ticketRes = await fetch(`${api.url}/v1/projects/${projectId}/actions?targetType=ticket`);
      const ticketActions = await ticketRes.json();
      expect(ticketActions).toHaveLength(1);
      expect(ticketActions[0].key).toBe("project.multi-target.ticketAction");

      const wsRes = await fetch(`${api.url}/v1/projects/${projectId}/actions?targetType=workspace`);
      const wsActions = await wsRes.json();
      expect(wsActions).toHaveLength(1);
      expect(wsActions[0].key).toBe("project.multi-target.workspaceAction");
    },
    TEST_TIMEOUT,
  );

  test(
    "executes an extension command action for a workspace target",
    async () => {
      const { repo, projectId } = await setupProjectWithRepo("extension-exec");

      writeExtension(
        repo,
        "exec-action",
        `export default {
          id: "project.exec-action",
          name: "Exec Action",
          commands: {
            noop: {
              title: "No-op action",
              target: "workspace",
              menus: [{ slot: "workspace.header.overflow" }],
              async run() {},
            },
          },
        };`,
      );

      const workspaceRes = await fetch(`${api.url}/v1/workspaces`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, name: "PLUGIN-A1" }),
      });
      const workspace = (await workspaceRes.json()) as { id: string };

      const actionKey = encodeURIComponent("project.exec-action.noop");
      const res = await fetch(`${api.url}/v1/projects/${projectId}/actions/${actionKey}/execute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ target_type: "workspace", target_id: workspace.id }),
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
        body: JSON.stringify({ target_type: "workspace", target_id: "fake-id" }),
      });

      expect(res.status).toBe(404);
    },
    TEST_TIMEOUT,
  );

  test(
    "returns empty actions for project with no extension command menus",
    async () => {
      const { projectId } = await setupProjectWithRepo("extension-empty");

      const res = await fetch(`${api.url}/v1/projects/${projectId}/actions`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual([]);
    },
    TEST_TIMEOUT,
  );
});
