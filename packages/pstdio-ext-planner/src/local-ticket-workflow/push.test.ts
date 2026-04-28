import { afterEach, describe, expect, mock, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { PlannerTicketWorkflowContext, TicketPushInput } from "../contract";
import { pushLocalTicket } from "./push";

let tempRoots: string[] = [];

afterEach(() => {
  for (const root of tempRoots) rmSync(root, { recursive: true, force: true });
  tempRoots = [];
});

const writeLocalTicket = (content: string) => {
  const projectRoot = mkdtempSync(join(tmpdir(), "pstdio-planner-workflow-"));
  tempRoots.push(projectRoot);

  const ticketDir = join(projectRoot, ".pstdio", "tickets", "PS-1");
  mkdirSync(ticketDir, { recursive: true });
  const ticketPath = join(ticketDir, "ticket.md");
  writeFileSync(ticketPath, content);

  return { projectRoot, ticketPath };
};

const buildContext = (projectRoot: string, overrides: Partial<PlannerTicketWorkflowContext["tickets"]>) =>
  ({
    projectId: "project-1",
    projectRoot,
    tickets: {
      get: mock(async () => null),
      getByShorthand: mock(async () => ({
        id: "ticket-1",
        projectId: "project-1",
        shorthand: "PS-1",
        createdAt: "2026-04-27T00:00:00.000Z",
        draft: true,
        fileId: "file-1",
        parentId: null,
        userPrompt: null,
        dependsOn: null,
        parallelizable: null,
        blockedReason: null,
        tagNames: [],
      })),
      list: mock(async () => []),
      listFiles: mock(async () => []),
      readFileContent: mock(async () => Buffer.from("")),
      uploadFile: mock(async () => ({
        id: "uploaded-file",
        fileId: "generic-file-1",
        fileName: "ticket.md",
        mimeType: "text/markdown",
      })),
      update: mock(async () => null),
      delete: mock(async () => false),
      resolveStatusId: mock(async () => "status-1"),
      resolveTagIds: mock(async () => []),
      ...overrides,
    },
  }) satisfies PlannerTicketWorkflowContext;

const expectInvalidPushDoesNotMutate = async (
  input: TicketPushInput,
  overrides: Partial<PlannerTicketWorkflowContext["tickets"]>,
) => {
  const content = ["---", "draft: true", "---", "# Updated title", "", "Updated body."].join("\n");
  const { projectRoot, ticketPath } = writeLocalTicket(content);
  const ctx = buildContext(projectRoot, overrides);

  await expect(pushLocalTicket(ctx, input)).rejects.toThrow();

  expect(ctx.tickets.uploadFile).not.toHaveBeenCalled();
  expect(ctx.tickets.update).not.toHaveBeenCalled();
  expect(readFileSync(ticketPath, "utf8")).toBe(content);
};

describe("pushLocalTicket", () => {
  test("does not upload or mark local content saved when status resolution fails", async () => {
    await expectInvalidPushDoesNotMutate(
      { ticketId: "PS-1", status: "invalid" },
      {
        resolveStatusId: mock(async () => {
          throw new Error("Status not found: invalid");
        }),
      },
    );
  });

  test("does not upload or mark local content saved when tag resolution fails", async () => {
    await expectInvalidPushDoesNotMutate(
      { ticketId: "PS-1", tags: ["invalid"] },
      {
        resolveTagIds: mock(async () => {
          throw new Error("Tag option not found: invalid");
        }),
      },
    );
  });
});
