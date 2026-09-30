import { describe, expect, test } from "bun:test";
import type { ExtensionWorkspace } from "@pstdio/sdk/extensions";
import { createTicketParentLookup, createTicketWorkspaceLookup, TICKET_RESOURCE_KIND, ticketToRow } from "./mappers";
import type { StoredTag, StoredTicket } from "./types";

const ticket: StoredTicket = {
  id: "t1",
  shorthand: "T-1",
  title: "Fix the thing",
  content: "body",
  statusId: "s-todo",
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
};

describe("ticketToRow", () => {
  test("maps a ticket to a kanban-renderer row with a ticket resource", () => {
    const row = ticketToRow(ticket, "proj-1");

    expect(row.id).toBe("t1");
    // Card title drops the shorthand prefix; the breadcrumb keeps it via resource.label.
    expect(row.title).toBe("Fix the thing");
    expect(row.resource).toEqual({
      type: TICKET_RESOURCE_KIND,
      id: "t1",
      projectId: "proj-1",
      label: "T-1 Fix the thing",
      icon: "component",
      shorthand: "T-1",
      metadata: {
        archived: false,
        resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
      },
    });
    expect(row.attributes).toEqual({
      status: "s-todo",
      archived: "active",
      created: "2026-01-01T00:00:00.000Z",
      updated: "2026-01-02T00:00:00.000Z",
      id: "T-1",
      parent: "",
      workspace: "",
      workspaceItems: [],
    });
  });

  test("falls back to the shorthand when there is no title", () => {
    const row = ticketToRow({ ...ticket, title: "" }, "proj-1");
    expect(row.title).toBe("T-1");
  });

  test("maps archived tickets to the archived filter value", () => {
    const row = ticketToRow({ ...ticket, archived: true }, "proj-1");

    expect(row.attributes.archived).toBe("archived");
  });

  test("adds a canonical parent resource edge to child ticket resources", () => {
    const child = { ...ticket, id: "t2", shorthand: "T-2", title: "Child", parentId: ticket.id };
    const row = ticketToRow(child, "proj-1", [], new Map(), createTicketParentLookup([ticket, child]));

    expect(row.resource.metadata).toEqual({
      archived: false,
      resourceParent: {
        type: "ticket",
        id: "t1",
        label: "T-1 Fix the thing",
        shorthand: "T-1",
        metadata: {
          resourceParent: { type: "view", viewId: "pstdio.pstdio-planner.view.tickets" },
        },
      },
    });
    expect(row.attributes).toMatchObject({
      id: "T-1 / T-2",
      parent: "T-1",
    });
  });

  test("maps the complete root-first shorthand ancestry and direct parent", () => {
    const parent = { ...ticket, id: "t2", shorthand: "T-2", parentId: ticket.id };
    const child = { ...ticket, id: "t3", shorthand: "T-3", parentId: parent.id };

    const row = ticketToRow(child, "proj-1", [], new Map(), createTicketParentLookup([ticket, parent, child]));

    expect(row.attributes).toMatchObject({
      id: "T-1 / T-2 / T-3",
      parent: "T-2",
    });
  });

  test("maps legacy default type selections as a single scalar value", () => {
    const typeTag: StoredTag = {
      id: "default-type",
      name: "Type",
      type: "multi_select",
      sortOrder: 0,
      options: [
        { id: "default-type-bug", name: "Bug", color: "red", icon: "bug", description: null, sortOrder: 0 },
        {
          id: "default-type-feature",
          name: "Feature",
          color: "green",
          icon: "sparkles",
          description: null,
          sortOrder: 1,
        },
      ],
    };

    const row = ticketToRow({ ...ticket, tagIds: ["default-type-bug", "default-type-feature"] }, "proj-1", [typeTag]);

    expect((row.attributes as Record<string, unknown>).type).toBe("default-type-bug");
  });
});

describe("createTicketWorkspaceLookup", () => {
  const workspace = (id: string, shorthand: string, createdAt: string): ExtensionWorkspace => ({
    id,
    workspace_shorthand: shorthand,
    anchors_json: [{ type: "ticket", id: "ticket-1", shorthand: "T-1" }],
    root_path: `/worktrees/${shorthand}`,
    created_at: createdAt,
  });

  test("attaches each workspace's latest session to its own badge item", () => {
    const items = createTicketWorkspaceLookup(
      [
        workspace("workspace-1", "T-1_A1", "2026-01-02T00:00:00.000Z"),
        workspace("workspace-2", "T-1_A2", "2026-01-03T00:00:00.000Z"),
      ],
      new Map([
        ["workspace-1", { id: "session-1", status: "completed" as const }],
        ["workspace-2", { id: "session-2", status: "in_progress" as const }],
      ]),
    ).get("T-1");

    // Newest workspace first, each carrying the session of that same workspace.
    expect(items?.map((item) => [item.id, item.session])).toEqual([
      ["workspace-2", { id: "session-2", status: "in_progress" }],
      ["workspace-1", { id: "session-1", status: "completed" }],
    ]);
  });

  test("omits the session field for workspaces without sessions", () => {
    const items = createTicketWorkspaceLookup([workspace("workspace-1", "T-1_A1", "2026-01-02T00:00:00.000Z")]).get(
      "T-1",
    );

    expect(items?.[0]).not.toHaveProperty("session");
  });

  test("passes every supported session status through unchanged", () => {
    const statuses = [
      "queued",
      "in_progress",
      "awaiting_input",
      "completed",
      "failed",
      "cancelled",
      "disconnected",
    ] as const;

    for (const status of statuses) {
      const items = createTicketWorkspaceLookup(
        [workspace("workspace-1", "T-1_A1", "2026-01-02T00:00:00.000Z")],
        new Map([["workspace-1", { id: "session-1", status }]]),
      ).get("T-1");

      expect(items?.[0]?.session).toEqual({ id: "session-1", status });
    }
  });
});
