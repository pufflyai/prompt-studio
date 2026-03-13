import { describe, expect, mock, test } from "bun:test";
import { homedir } from "node:os";
import { join } from "node:path";
import { createWorkspaceForTicket } from "./create-workspace-for-ticket";

const mockTicket = {
  id: "t-1",
  shorthand: "PS-1",
  project_id: "proj-1",
  status_id: null,
  display_title: "Test",
  file_id: null,
  priority: null,
  complexity: null,
  draft: false,
  archived: false,
  status_name: null,
  tag_names: [],
  created_at: "2026-03-05T00:00:00.000Z",
};

const mockWorkspace = {
  id: "ws-1",
  project_id: "proj-1",
  name: "PS-1_A1",
  workspace_shorthand: "PS-1_A1",
  branch: "workspace/PS-1_A1",
  worktree_path: join(homedir(), ".pstdio", "workspaces", "PS-1_A1"),
  status: "active",
  created_at: "2026-03-05T00:00:00.000Z",
  updated_at: "2026-03-05T00:00:00.000Z",
};

const mockTicketAttempt = {
  mode: "worktree" as const,
  ticket: {
    id: "t-1",
    shorthand: "PS-1",
    display_title: "Test",
  },
  workspace: mockWorkspace,
  session: null,
};

const baseDeps = {
  listTickets: async () => [mockTicket],
  createTicketAttempt: async () => mockTicketAttempt,
  getStartupScript: async () => null as string | null,
  setStartupLog: mock(async () => ({ file_id: "f-1" })),
  exec: mock() as never,
  log: mock() as (...args: unknown[]) => void,
};

describe("createWorkspaceForTicket", () => {
  test("creates workspace via ticket-attempt API with start_session=false", async () => {
    const log = mock();
    const createTicketAttempt = mock(async () => mockTicketAttempt);

    const result = await createWorkspaceForTicket(
      { projectId: "proj-1", repoRoot: "/repo", ticketShorthand: "PS-1" },
      { ...baseDeps, createTicketAttempt, log },
    );

    expect(createTicketAttempt).toHaveBeenCalledTimes(1);
    expect(createTicketAttempt).toHaveBeenCalledWith("http://localhost:19840", "t-1", {
      mode: "worktree",
      start_session: false,
      base: "HEAD",
      repo_path: "/repo",
    });
    expect(log).toHaveBeenCalledWith(
      `Created workspace PS-1_A1 for PS-1 at ${join(homedir(), ".pstdio", "workspaces", "PS-1_A1")}`,
    );
    expect(result).toEqual(mockWorkspace);
  });

  test("throws when ticket not found", async () => {
    await expect(
      createWorkspaceForTicket(
        { projectId: "proj-1", repoRoot: "/repo", ticketShorthand: "PS-99" },
        { ...baseDeps, listTickets: async () => [] },
      ),
    ).rejects.toThrow("Ticket not found: PS-99");
  });

  test("uses base ref when provided", async () => {
    const createTicketAttempt = mock(async () => mockTicketAttempt);

    await createWorkspaceForTicket(
      { projectId: "proj-1", repoRoot: "/repo", ticketShorthand: "PS-1", base: "main" },
      { ...baseDeps, createTicketAttempt },
    );

    expect(createTicketAttempt).toHaveBeenCalledWith("http://localhost:19840", "t-1", {
      mode: "worktree",
      start_session: false,
      base: "main",
      repo_path: "/repo",
    });
  });
});
