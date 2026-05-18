import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs } from "./helpers";
import {
  createInitializedRepo,
  getProjectId,
  getStatusId,
  type HookTestContext,
  registerRepo,
  wait,
  writePlugin,
} from "./hooks-infra";
import { type ApiInstance, startApi } from "./start-api";
import { FLOW_TIMEOUT, SETUP_TIMEOUT } from "./timeouts";

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

// Plugin-driven attempt-status flows were removed when the workspace
// extension took ownership of `set-attempt-status`. The equivalent extension
// hook coverage will land alongside the broader plugin-to-extension migration.

describe("ticket status change hook triggers further actions", () => {
  test(
    "postTicketStatusChange branches on target status name",
    async () => {
      const repo = createInitializedRepo(ctx, "combo-status-branch");
      const projectId = getProjectId(repo);

      writePlugin(
        repo,
        "combo-status-branch-plugin.ts",
        `
import { writeFileSync } from "node:fs";

export default {
  hooks: {
    postTicketStatusChange(ctx) {
      const statusName = ctx.toStatus;
      if (statusName === "wip") {
        writeFileSync("${repo}/status-action.txt", "moved-to-wip");
      } else if (statusName === "done") {
        writeFileSync("${repo}/status-action.txt", "moved-to-done");
      }
    },
  },
};
`,
      );
      await registerRepo(ctx, projectId, repo, "combo-status-branch-repo");

      // Create a ticket
      const ticketRes = await fetch(`${api.url}/v1/tickets`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ project_id: projectId, user_prompt: "branch test" }),
      });
      const ticket = (await ticketRes.json()) as { id: string };

      // Move to wip
      const wipId = await getStatusId(ctx, projectId, "wip");
      await fetch(`${api.url}/v1/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_id: wipId }),
      });
      await wait(1500);

      expect(existsSync(join(repo, "status-action.txt"))).toBe(true);
      expect(readFileSync(join(repo, "status-action.txt"), "utf8").trim()).toBe("moved-to-wip");

      // Move to done
      const doneId = await getStatusId(ctx, projectId, "done");
      await fetch(`${api.url}/v1/tickets/${ticket.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status_id: doneId }),
      });
      await wait(1500);

      expect(readFileSync(join(repo, "status-action.txt"), "utf8").trim()).toBe("moved-to-done");
    },
    FLOW_TIMEOUT,
  );
});
