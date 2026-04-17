import { describe, expect, test } from "bun:test";
import type { TicketAttempt } from "@/features/ticket-list/types";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";
import { sortWorkspacesByLatestSession } from "./ticket-sidebar-workspaces";

const buildWorkspace = (overrides: Partial<TicketAttempt>): TicketAttempt => ({
  id: "workspace-1",
  label: "Workspace 1",
  attemptStatusId: null,
  sessionStatus: null,
  shorthand: "PS-34_A1",
  updatedAt: "2026-04-10T10:00:00.000Z",
  worktreePath: "/tmp/workspace-1",
  ...overrides,
});

const buildSession = (createdAt: string): WorkspaceSessionEntry => ({
  id: `session:${createdAt}`,
  title: "Session",
  status: "completed",
  agent: "opencode",
  createdAt,
});

describe("sortWorkspacesByLatestSession", () => {
  test("orders workspaces by latest session activity before workspace updatedAt", () => {
    const workspaces = [
      buildWorkspace({ id: "workspace-1", shorthand: "PS-34_A1", updatedAt: "2026-04-10T10:00:00.000Z" }),
      buildWorkspace({ id: "workspace-2", shorthand: "PS-34_A2", updatedAt: "2026-04-10T11:00:00.000Z" }),
    ];
    const sessionsByWorkspaceId = new Map<string, WorkspaceSessionEntry[]>([
      ["workspace-1", [buildSession("2026-04-10T12:00:00.000Z")]],
      ["workspace-2", [buildSession("2026-04-10T11:30:00.000Z")]],
    ]);

    expect(sortWorkspacesByLatestSession(workspaces, sessionsByWorkspaceId).map((workspace) => workspace.id)).toEqual([
      "workspace-1",
      "workspace-2",
    ]);
  });

  test("falls back to workspace updatedAt when no sessions exist", () => {
    const workspaces = [
      buildWorkspace({ id: "workspace-1", shorthand: "PS-34_A1", updatedAt: "2026-04-10T10:00:00.000Z" }),
      buildWorkspace({ id: "workspace-2", shorthand: "PS-34_A2", updatedAt: "2026-04-10T11:00:00.000Z" }),
    ];

    expect(sortWorkspacesByLatestSession(workspaces, new Map()).map((workspace) => workspace.id)).toEqual([
      "workspace-2",
      "workspace-1",
    ]);
  });
});
