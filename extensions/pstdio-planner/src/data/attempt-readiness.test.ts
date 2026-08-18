import { describe, expect, test } from "bun:test";
import { resolveAttemptReadiness } from "./attempt-readiness";
import type { AttemptRecord, TicketAttemptSelection } from "./attempt-types";

const attempt = (ticketId: string, workspaceId: string, headSha: string): AttemptRecord => ({
  schemaVersion: 1,
  workspaceId,
  workspaceShorthand: `${ticketId}_A1`,
  ticketId,
  ticketShorthand: ticketId,
  implementationSessionId: `session-${workspaceId}`,
  state: "approved",
  base: { workspaceId: null, headSha: "main" },
  revisions: [
    {
      revision: 1,
      baseSha: "main",
      headSha,
      changeRequestReportId: `report-${workspaceId}`,
      submittedAt: "2026-08-18T10:00:00.000Z",
      submittedBy: { type: "agent", id: "agent", displayName: "Agent" },
      reviews: [],
    },
  ],
  implementationDisconnectRetries: 0,
  reviewDisconnectRetries: 0,
  blocker: null,
  createdAt: "2026-08-18T09:00:00.000Z",
  updatedAt: "2026-08-18T10:00:00.000Z",
});

const ticket = (id: string, dependsOn: string[] = []) => ({
  id,
  shorthand: id,
  statusId: "ready",
  dependsOn,
  parallelizable: "yes",
});

const resolve = (input: {
  tickets: ReturnType<typeof ticket>[];
  attempts?: AttemptRecord[];
  selections?: TicketAttemptSelection[];
  ancestors?: Array<[string, string]>;
  target?: string;
}) =>
  resolveAttemptReadiness({
    target: input.target ?? "PS-3",
    tickets: input.tickets,
    attempts: input.attempts ?? [],
    selections: input.selections ?? [],
    doneStatusIds: new Set(["done"]),
    mainHeadSha: "main",
    hasActiveImplementation: false,
    isAncestor: async (base, head) =>
      base === head || (input.ancestors ?? []).some(([a, b]) => a === base && b === head),
  });

describe("attempt readiness", () => {
  test("starts from main when every dependency is merged", async () => {
    const dependency = { ...ticket("PS-1"), statusId: "done" };

    await expect(resolve({ tickets: [dependency, ticket("PS-3", ["PS-1"])] })).resolves.toEqual({
      decision: "ready",
      mode: "main",
      baseWorkspaceId: null,
      baseHeadSha: "main",
      dependencyAttemptIds: [],
    });
  });

  test("chooses the unique stacked tip containing every unresolved dependency", async () => {
    const first = attempt("PS-1", "workspace-1", "head-1");
    const second = attempt("PS-2", "workspace-2", "head-2");

    await expect(
      resolve({
        tickets: [ticket("PS-1"), ticket("PS-2", ["PS-1"]), ticket("PS-3", ["PS-1", "PS-2"])],
        attempts: [first, second],
        ancestors: [["head-1", "head-2"]],
      }),
    ).resolves.toEqual({
      decision: "ready",
      mode: "stacked",
      baseWorkspaceId: "workspace-2",
      baseHeadSha: "head-2",
      dependencyAttemptIds: ["workspace-1", "workspace-2"],
    });
  });

  test("waits for ambiguous attempts until one is selected", async () => {
    const attempts = [attempt("PS-1", "workspace-1", "head-1"), attempt("PS-1", "workspace-2", "head-2")];

    await expect(resolve({ tickets: [ticket("PS-1"), ticket("PS-3", ["PS-1"])], attempts })).resolves.toEqual({
      decision: "wait",
      reason: "ambiguous-dependency-attempt",
      dependencyIds: ["PS-1"],
    });
  });

  test("waits when selected dependency heads diverge", async () => {
    const attempts = [attempt("PS-1", "workspace-1", "head-1"), attempt("PS-2", "workspace-2", "head-2")];

    await expect(
      resolve({ tickets: [ticket("PS-1"), ticket("PS-2"), ticket("PS-3", ["PS-1", "PS-2"])], attempts }),
    ).resolves.toEqual({
      decision: "wait",
      reason: "divergent-dependency-attempts",
      dependencyIds: ["PS-1", "PS-2"],
    });
  });

  test.each([
    { tickets: [ticket("PS-3", ["PS-404"])], reason: "dependency-missing" },
    { tickets: [ticket("PS-1", ["PS-3"]), ticket("PS-3", ["PS-1"])], reason: "dependency-cycle" },
  ])("waits for $reason", async ({ tickets, reason }) => {
    await expect(resolve({ tickets: [...tickets] })).resolves.toMatchObject({ decision: "wait", reason });
  });
});
