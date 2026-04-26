import { describe, expect, mock, test } from "bun:test";
import type { SidebarNavigateEvent } from "@pstdio/ui";
import type { TicketAttempt } from "@/features/ticket-list/types";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";
import { buildSubTicketsSection, buildWorkspacesSection, handleTicketSidebarNavigate } from "./ticket-sidebar";
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

describe("buildWorkspacesSection", () => {
  test("adds a create action when workspace creation is available", () => {
    const onCreateWorkspace = mock(() => {});

    const section = buildWorkspacesSection([], new Map(), new Map(), new Map(), onCreateWorkspace);

    expect(section.actions).toHaveLength(1);
    expect(section.actions?.[0]?.id).toBe("new-workspace");
    expect(section.actions?.[0]?.label).toBe("New workspace");

    section.actions?.[0]?.onAction?.({ sectionId: "workspaces" });

    expect(onCreateWorkspace).toHaveBeenCalled();
  });
});

describe("buildSubTicketsSection", () => {
  test("returns null when the ticket has no sub-tickets", () => {
    expect(
      buildSubTicketsSection(
        [],
        "Sub-tickets",
        [],
        mock(() => {}),
      ),
    ).toBeNull();
  });

  test("builds selectable child ticket nodes with shorthand payload", () => {
    const section = buildSubTicketsSection(
      [
        {
          id: "ticket-2",
          shorthand: "PS-34",
          title: "First child",
          statusId: null,
          status: "In Progress",
          statusColor: "yellow",
        },
        { id: "ticket-3", shorthand: "PS-35", title: "Second child", statusId: null },
      ],
      "Sub-tickets",
      ["ticket-2", "ticket-3"],
      mock(() => {}),
    );

    expect(section).not.toBeNull();
    expect(section?.id).toBe("sub-tickets");
    expect(section?.label).toBe("Sub-tickets");
    expect(section?.nodes).toHaveLength(2);
    expect(section?.nodes[0]).toMatchObject({
      id: "sub-ticket:ticket-2",
      label: "PS-34 First child",
      isNavigable: true,
      navigationIntent: { id: "select-sub-ticket", payload: { ticketShorthand: "PS-34" } },
    });
    expect(section?.nodes[0]?.indicator).toMatchObject({
      color: "yellow.fg",
      tooltip: "In Progress",
    });
  });

  test("disables unresolved child tickets", () => {
    const section = buildSubTicketsSection(
      [
        { id: "ticket-2", shorthand: "PS-34", title: "First child", statusId: null },
        { id: "ticket-3", shorthand: "PS-35", title: "Second child", statusId: null },
      ],
      "Sub-tickets",
      ["ticket-2"],
      mock(() => {}),
    );

    expect(section?.nodes[0]).toMatchObject({
      id: "sub-ticket:ticket-2",
      disabled: false,
      isNavigable: true,
      navigationIntent: { id: "select-sub-ticket", payload: { ticketShorthand: "PS-34" } },
    });
    expect(section?.nodes[1]).toMatchObject({
      id: "sub-ticket:ticket-3",
      disabled: true,
      isNavigable: false,
    });
    expect(section?.nodes[1]?.navigationIntent).toBeUndefined();
  });

  test("disables child tickets when no handler is provided", () => {
    const section = buildSubTicketsSection(
      [{ id: "ticket-2", shorthand: "PS-34", title: "First child", statusId: null }],
      "Sub-tickets",
      ["ticket-2"],
    );

    expect(section?.nodes[0]).toMatchObject({
      id: "sub-ticket:ticket-2",
      disabled: true,
      isNavigable: false,
    });
    expect(section?.nodes[0]?.navigationIntent).toBeUndefined();
  });

  test("falls back to the title when shorthand is missing", () => {
    const section = buildSubTicketsSection(
      [{ id: "ticket-2", shorthand: "", title: "Child without shorthand", statusId: null }],
      "Sub-tickets",
      ["ticket-2"],
      mock(() => {}),
    );

    expect(section).toMatchObject({
      nodes: [{ id: "sub-ticket:ticket-2", label: "Child without shorthand", disabled: true, isNavigable: false }],
    });
  });

  test("keeps the sub-ticket section collapsible", () => {
    const section = buildSubTicketsSection(
      [{ id: "ticket-2", shorthand: "PS-34", title: "First child", statusId: null }],
      "Sub-tickets",
      ["ticket-2"],
      mock(() => {}),
    );

    expect(section?.collapsible).not.toBe(false);
  });
});

describe("handleTicketSidebarNavigate", () => {
  test("dispatches sub-ticket navigation intent", () => {
    const onSelectSubTicket = mock(() => {});

    handleTicketSidebarNavigate(
      {
        sectionId: "sub-tickets",
        nodeId: "sub-ticket:ticket-2",
        node: { id: "sub-ticket:ticket-2", label: "PS-34" },
        intent: { id: "select-sub-ticket", payload: { ticketShorthand: "PS-34" } },
      } satisfies SidebarNavigateEvent,
      {
        onSelectFile: mock(() => {}),
        onSelectSubTicket,
        onSelectWorkspace: mock(() => {}),
        onSelectSession: mock(() => {}),
      },
    );

    expect(onSelectSubTicket).toHaveBeenCalledWith("PS-34");
  });
});
