import { describe, expect, it } from "bun:test";
import type { Ticket, TicketAttempt } from "@/features/ticket-list/types";
import { buildLatestAttemptsByTicketId, toSessionIndicatorStatus } from "./ticket-attempts";

const makeAttempt = (overrides: Partial<TicketAttempt>): TicketAttempt => ({
  id: "workspace-1",
  label: "Attempt 1",
  attemptStatusId: null,
  sessionStatus: "in_progress",
  shorthand: "PS-1_A1",
  updatedAt: "2026-03-13T10:00:00.000Z",
  worktreePath: null,
  ...overrides,
});

const makeTicket = (overrides: Partial<Ticket>): Ticket => ({
  id: "ticket-1",
  shorthand: "PS-1",
  title: "Ticket",
  content: "",
  tagIds: [],
  status: "Backlog",
  updatedAt: "2026-03-13T10:00:00.000Z",
  attempts: [],
  ...overrides,
});

describe("buildLatestAttemptsByTicketId", () => {
  it("uses the most recently updated attempt per ticket", () => {
    const oldest = makeAttempt({
      id: "workspace-old",
      shorthand: "PS-1_A1",
      updatedAt: "2026-03-13T09:00:00.000Z",
    });
    const newest = makeAttempt({
      id: "workspace-new",
      shorthand: "PS-1_A2",
      updatedAt: "2026-03-13T11:00:00.000Z",
    });

    const attemptsByTicket = buildLatestAttemptsByTicketId([
      makeTicket({
        id: "ticket-1",
        attempts: [oldest, newest],
      }),
    ]);

    expect(attemptsByTicket.get("ticket-1")?.id).toBe("workspace-new");
  });

  it("ignores tickets without attempts", () => {
    const attemptsByTicket = buildLatestAttemptsByTicketId([makeTicket({ id: "ticket-1", attempts: [] })]);
    expect(attemptsByTicket.has("ticket-1")).toBe(false);
  });
});

describe("toSessionIndicatorStatus", () => {
  it("prefers linked session status for the indicator", () => {
    expect(toSessionIndicatorStatus("in_progress")).toBe("in_progress");
    expect(toSessionIndicatorStatus("awaiting_input")).toBe("awaiting_input");
    expect(toSessionIndicatorStatus("completed")).toBe("completed");
    expect(toSessionIndicatorStatus("failed")).toBe("failed");
    expect(toSessionIndicatorStatus("cancelled")).toBe("failed");
  });

  it("does not derive status from workspace state when session status is unavailable", () => {
    expect(toSessionIndicatorStatus(null)).toBeUndefined();
  });
});
