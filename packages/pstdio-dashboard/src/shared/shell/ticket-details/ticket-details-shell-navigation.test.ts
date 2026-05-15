import { describe, expect, it } from "bun:test";
import type { TicketAttempt } from "@/features/ticket-list/types";
import type { WorkspaceSessionEntry } from "@/features/workspaces/hooks/use-workspace-sessions";
import {
  createTicketDetailsNavigationSections,
  openTicketDetailsNavigationResource,
} from "./ticket-details-shell-navigation";

const workspace = {
  id: "workspace-1",
  label: "Workspace 1",
  attemptStatusId: null,
  sessionStatus: null,
  shorthand: "PS-1_A1",
  updatedAt: "2026-01-01T00:00:00.000Z",
  worktreePath: "/tmp/workspace",
} satisfies TicketAttempt;

const session = {
  id: "session-1",
  title: "Session 1",
  status: "completed",
  agent: null,
  agentSessionId: null,
  createdAt: "2026-01-01T00:00:00.000Z",
} satisfies WorkspaceSessionEntry;

const createSections = () =>
  createTicketDetailsNavigationSections({
    attemptStatusMap: new Map(),
    diffTotalsByWorkspaceId: new Map(),
    files: [{ id: "file-1", fileName: "notes.md", label: "notes" }],
    projectId: "project-1",
    sessionsByWorkspaceId: new Map(),
    subTickets: [],
    ticketShorthand: "PS-1",
    workspaces: [],
    onCreateWorkspace: () => undefined,
  });

describe("createTicketDetailsNavigationSections", () => {
  it("keeps the ticket content file mounted in the shell tree", () => {
    const filesSection = createSections().find((section) => section.id === "files");

    expect(filesSection?.nodes.map((node) => node.id)).toEqual(["file:ticket", "file:file-1"]);
    expect(filesSection?.nodes[0]).toMatchObject({
      label: "Ticket",
      icon: "FileText",
    });
  });

  it("routes the ticket content file through the shell resource opener", () => {
    const filesSection = createSections().find((section) => section.id === "files");
    const selectedFileIds: string[] = [];
    const resource = filesSection?.nodes[0]?.resource;

    expect(resource).toBeDefined();
    if (!resource) throw new Error("Expected ticket content resource");

    openTicketDetailsNavigationResource(resource, {
      onSelectFile: (fileId) => selectedFileIds.push(fileId),
      onSelectPlanning: () => undefined,
      onSelectSession: () => undefined,
      onSelectSubTicket: () => undefined,
      onSelectWorkspace: () => undefined,
    });

    expect(selectedFileIds).toEqual(["ticket"]);
  });

  it("keeps ticket, workspace, and session resource context menu actions in the shell tree", () => {
    const sections = createTicketDetailsNavigationSections({
      attemptStatusMap: new Map(),
      diffTotalsByWorkspaceId: new Map(),
      files: [],
      projectId: "project-1",
      sessionsByWorkspaceId: new Map([[workspace.id, [session]]]),
      subTickets: [],
      ticketShorthand: "PS-1",
      workspaces: [workspace],
      resolveSessionContextMenuActions: (entry) => [{ id: `session:${entry.id}`, label: "Session action" }],
      resolveTicketContextMenuActions: () => [{ id: "ticket-action", label: "Ticket action" }],
      resolveWorkspaceContextMenuActions: (entry) => [{ id: `workspace:${entry.id}`, label: "Workspace action" }],
      onCreateWorkspace: () => undefined,
    });

    const ticketNode = sections.find((section) => section.id === "files")?.nodes[0];
    const workspaceNode = sections.find((section) => section.id === "workspaces")?.nodes[0];

    expect(ticketNode?.contextMenuActions?.map((action) => action.id)).toEqual(["ticket-action"]);
    expect(workspaceNode?.contextMenuActions?.map((action) => action.id)).toEqual(["workspace:workspace-1"]);
    expect(workspaceNode?.children?.[0]?.contextMenuActions?.map((action) => action.id)).toEqual(["session:session-1"]);
  });
});
