import { afterAll, afterEach, beforeAll, describe, expect, test } from "bun:test";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cleanupDirs } from "./helpers";
import {
  createInitializedRepo,
  createRun,
  createRunSafe,
  executePlannerCommand,
  getAlternateStatusId,
  getProjectId,
  getStatusName,
  type HookTestContext,
  readPlannerTicketContent,
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
  const response = await executePlannerCommand(ctx, projectId, "createTicket", {
    content: "# Original title\n\nOriginal body.",
    title: "Original title",
  });

  expect(response.status).toBe(200);
  const body = (await response.json()) as { result: { id: string; shorthand: string; statusId: string | null } };
  return { id: body.result.id, shorthand: body.result.shorthand, status_id: body.result.statusId };
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

      const content = await readPlannerTicketContent(ctx, projectId, ticket.id);
      expect(content).toBe("# Original title\n\nOriginal body.");
    },
    TEST_TIMEOUT,
  );
});
