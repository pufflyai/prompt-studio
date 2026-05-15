import { describe, expect, it } from "bun:test";
import {
  createTicketDetailsNavigationSections,
  openTicketDetailsNavigationResource,
} from "./ticket-details-shell-navigation";

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
});
