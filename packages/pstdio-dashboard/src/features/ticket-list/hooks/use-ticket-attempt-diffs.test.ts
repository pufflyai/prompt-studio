import { describe, expect, test } from "bun:test";
import type { TicketAttempt } from "@/features/ticket-list/types";
import { shouldFetchTicketAttemptDiff } from "./use-ticket-attempt-diffs";

const buildAttempt = (overrides: Partial<TicketAttempt> = {}): TicketAttempt => ({
  id: "workspace-1",
  label: "Workspace 1",
  attemptStatusId: null,
  sessionStatus: null,
  shorthand: "PS-34_A1",
  updatedAt: "2026-04-17T00:00:00.000Z",
  worktreePath: "/tmp/workspace-1",
  ...overrides,
});

describe("shouldFetchTicketAttemptDiff", () => {
  test("returns true for attempts with a session status", () => {
    expect(shouldFetchTicketAttemptDiff(buildAttempt({ sessionStatus: "in_progress" }))).toBe(true);
  });

  test("returns true for attempts with an attempt status even without a session", () => {
    expect(shouldFetchTicketAttemptDiff(buildAttempt({ attemptStatusId: "status-1" }))).toBe(true);
  });

  test("returns false for untouched attempts without status or session", () => {
    expect(shouldFetchTicketAttemptDiff(buildAttempt())).toBe(false);
  });
});
