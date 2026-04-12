import { describe, expect, it } from "bun:test";
import type { TicketAttempt } from "@/features/ticket-list/types";
import { buildTicketDetailsDiffInputs } from "./ticket-details-panel-diff-inputs";

const makeWorkspace = (overrides: Partial<TicketAttempt>): TicketAttempt => ({
  id: "workspace-1",
  label: "Attempt 1",
  attemptStatusId: null,
  sessionStatus: null,
  shorthand: "PS-36_A1",
  updatedAt: "2026-04-12T00:00:00.000Z",
  worktreePath: null,
  ...overrides,
});

describe("buildTicketDetailsDiffInputs", () => {
  it("only marks settled workspaces as eligible for diff fetching", () => {
    const inputs = buildTicketDetailsDiffInputs([
      makeWorkspace({ id: "workspace-settled", sessionStatus: "completed" }),
      makeWorkspace({ id: "workspace-active", sessionStatus: "in_progress" }),
      makeWorkspace({ id: "workspace-none", sessionStatus: null }),
    ]);

    expect(inputs).toEqual([
      { workspaceId: "workspace-settled", settled: true },
      { workspaceId: "workspace-active", settled: false },
      { workspaceId: "workspace-none", settled: false },
    ]);
  });
});
