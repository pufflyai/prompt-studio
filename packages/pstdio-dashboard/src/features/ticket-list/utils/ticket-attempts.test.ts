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
  it("prefers a running session over newer inactive sessions", () => {
    const running = makeAttempt({
      id: "workspace-running",
      shorthand: "PS-1_A1",
      sessionStatus: "in_progress",
      sessionCreatedAt: "2026-03-13T09:00:00.000Z",
      updatedAt: "2026-03-13T09:00:00.000Z",
    });
    const completed = makeAttempt({
      id: "workspace-completed",
      shorthand: "PS-1_A2",
      sessionStatus: "completed",
      sessionCreatedAt: "2026-03-13T11:00:00.000Z",
      updatedAt: "2026-03-13T11:00:00.000Z",
    });

    const attemptsByTicket = buildLatestAttemptsByTicketId([
      makeTicket({
        id: "ticket-1",
        attempts: [running, completed],
      }),
    ]);

    expect(attemptsByTicket.get("ticket-1")?.id).toBe("workspace-running");
  });

  it("uses a newer terminal session over an older awaiting input session when no session is running", () => {
    const awaitingInput = makeAttempt({
      id: "workspace-awaiting-input",
      shorthand: "PS-1_A1",
      sessionStatus: "awaiting_input",
      sessionCreatedAt: "2026-03-13T09:00:00.000Z",
      updatedAt: "2026-03-13T09:00:00.000Z",
    });
    const completed = makeAttempt({
      id: "workspace-completed",
      shorthand: "PS-1_A2",
      sessionStatus: "completed",
      sessionCreatedAt: "2026-03-13T11:00:00.000Z",
      updatedAt: "2026-03-13T11:00:00.000Z",
    });

    const attemptsByTicket = buildLatestAttemptsByTicketId([
      makeTicket({
        id: "ticket-1",
        attempts: [awaitingInput, completed],
      }),
    ]);

    expect(attemptsByTicket.get("ticket-1")?.id).toBe("workspace-completed");
  });

  it("prefers running sessions over other active sessions", () => {
    const awaitingInput = makeAttempt({
      id: "workspace-awaiting-input",
      shorthand: "PS-1_A1",
      sessionStatus: "awaiting_input",
      sessionCreatedAt: "2026-03-13T11:00:00.000Z",
      updatedAt: "2026-03-13T11:00:00.000Z",
    });
    const running = makeAttempt({
      id: "workspace-running",
      shorthand: "PS-1_A2",
      sessionStatus: "in_progress",
      sessionCreatedAt: "2026-03-13T09:00:00.000Z",
      updatedAt: "2026-03-13T09:00:00.000Z",
    });

    const attemptsByTicket = buildLatestAttemptsByTicketId([
      makeTicket({
        id: "ticket-1",
        attempts: [awaitingInput, running],
      }),
    ]);

    expect(attemptsByTicket.get("ticket-1")?.id).toBe("workspace-running");
  });

  it("uses the most recently created non-archived session when no session is running", () => {
    const olderActiveSession = makeAttempt({
      id: "workspace-older-session",
      shorthand: "PS-1_A1",
      sessionStatus: "failed",
      sessionCreatedAt: "2026-03-13T11:00:00.000Z",
      updatedAt: "2026-03-13T09:00:00.000Z",
    });
    const newerWorkspace = makeAttempt({
      id: "workspace-newer-workspace",
      shorthand: "PS-1_A2",
      sessionStatus: "completed",
      sessionCreatedAt: "2026-03-13T10:00:00.000Z",
      updatedAt: "2026-03-13T12:00:00.000Z",
    });

    const attemptsByTicket = buildLatestAttemptsByTicketId([
      makeTicket({
        id: "ticket-1",
        attempts: [olderActiveSession, newerWorkspace],
      }),
    ]);

    expect(attemptsByTicket.get("ticket-1")?.id).toBe("workspace-older-session");
  });

  it("keeps a linked session ahead of newer attempts without sessions", () => {
    const linkedSession = makeAttempt({
      id: "workspace-linked-session",
      shorthand: "PS-1_A1",
      sessionStatus: "completed",
      sessionCreatedAt: "2026-03-13T10:00:00.000Z",
      updatedAt: "2026-03-13T10:00:00.000Z",
    });
    const noSession = makeAttempt({
      id: "workspace-no-session",
      shorthand: "PS-1_A2",
      sessionStatus: null,
      sessionCreatedAt: null,
      updatedAt: "2026-03-13T12:00:00.000Z",
    });

    const attemptsByTicket = buildLatestAttemptsByTicketId([
      makeTicket({
        id: "ticket-1",
        attempts: [linkedSession, noSession],
      }),
    ]);

    expect(attemptsByTicket.get("ticket-1")?.id).toBe("workspace-linked-session");
  });

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
    expect(toSessionIndicatorStatus("cancelled")).toBe("cancelled");
  });

  it("does not derive status from workspace state when session status is unavailable", () => {
    expect(toSessionIndicatorStatus(null)).toBeUndefined();
  });
});
