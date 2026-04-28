import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs } from "./helpers";
import {
  createInitializedRepo,
  createRun,
  createRunSafe,
  getAlternateStatusId,
  getProjectId,
  getStatusName,
  type HookTestContext,
  writePlugin,
} from "./hooks-infra";
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

const createTicket = async (projectId: string) => {
  const response = await fetch(`${api.url}/v1/tickets`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ project_id: projectId, content: "# Original title\n\nOriginal body." }),
  });

  expect(response.status).toBe(201);
  return (await response.json()) as { id: string; shorthand: string; status_id: string | null };
};

const readTicketDetail = async (ticketId: string) => {
  const response = await fetch(`${api.url}/v1/tickets/${ticketId}`);
  expect(response.status).toBe(200);
  return (await response.json()) as { file_id: string; status_id: string | null };
};

describe.skip("tickets save hooks", () => {
  test(
    "pre-ticket-status-change rejects tickets save without persisting content or status",
    async () => {
      const repo = createInitializedRepo(ctx, "pre-ticket-status-save");
      const projectId = getProjectId(repo);
      const run = createRun(ctx);
      const runSafe = createRunSafe(ctx);

      writePlugin(
        repo,
        "pre-ticket-status-save-guard.ts",
        `export default { hooks: { preTicketStatusChange: () => ({ reject: true, reason: "rejected" }) } };`,
      );

      const ticket = await createTicket(projectId);
      const nextStatusId = await getAlternateStatusId(ctx, projectId, ticket.status_id);
      const nextStatusName = await getStatusName(ctx, projectId, nextStatusId);
      if (!nextStatusName) throw new Error("Expected alternate status name");

      run(`tickets pull --id ${ticket.shorthand} --force`, repo);

      const ticketPath = join(repo, ".pstdio", "tickets", ticket.shorthand, "ticket.md");
      writeFileSync(
        ticketPath,
        readFileSync(ticketPath, "utf8").replace(
          "# Original title\n\nOriginal body.",
          "# Rejected title\n\nRejected body.",
        ),
      );

      const result = runSafe(`tickets save --id ${ticket.shorthand} --status "${nextStatusName}"`, repo);
      expect(result.exitCode).not.toBe(0);
      expect(result.stderr).toContain("rejected");

      const detail = await readTicketDetail(ticket.id);
      expect(detail.status_id).toBe(ticket.status_id);

      const contentResponse = await fetch(`${api.url}/v1/tickets/${ticket.id}/files/${detail.file_id}/content`);
      expect(contentResponse.status).toBe(200);
      expect(await contentResponse.text()).toBe("# Original title\n\nOriginal body.");
    },
    TEST_TIMEOUT,
  );
});
