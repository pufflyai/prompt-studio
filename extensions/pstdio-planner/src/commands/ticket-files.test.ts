import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import type { StoredTicketAttachment } from "../data/types";
import { attachTicketFileCommand } from "./attach-ticket-file";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { selectTicketDocumentCommand } from "./select-ticket-document";
import { createTicketFileCommand, listTicketFilesTreeCommand } from "./ticket-files";

describe("ticket files tree commands", () => {
  test("returns a native tree section for the ticket body and editable files", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    const file = await createTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
    );
    // The editor filters the broadcast by ticketId, so the result must carry it.
    expect(file).toMatchObject({ ticketId: ticket.id });

    const body = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-planner.ticketFiles",
          resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
        },
      }),
    );

    expect(body.map((section) => section.id)).toEqual(["ticket", "files", "workspaces"]);

    // The ticket body is its own header-less entry, selected by default.
    expect(body[0]).toEqual({
      id: "ticket",
      collapsible: false,
      nodes: [
        {
          id: "__ticket__",
          label: "Ticket",
          icon: "FileText",
          target: {
            kind: "command",
            commandId: "pstdio-planner.select-ticket-document",
            args: { ticketId: ticket.id, documentId: "__ticket__" },
          },
          selected: true,
        },
      ],
    });

    // The file lives in the Files section; selecting it runs select-ticket-document.
    expect(body[1]).toMatchObject({ id: "files", label: "Files" });
    expect(body[1]?.nodes).toEqual([
      {
        id: file.id,
        label: "notes.md",
        icon: "FileText",
        target: {
          kind: "command",
          commandId: "pstdio-planner.select-ticket-document",
          args: { ticketId: ticket.id, documentId: file.id },
        },
        selected: false,
        contextMenuActions: [
          {
            id: "rename",
            label: "Rename",
            icon: "Pencil",
            commandId: "pstdio-planner.rename-ticket-file",
            args: { ticketId: ticket.id, fileId: file.id, name: "notes.md" },
            submitLabel: "Save",
            params: {
              name: { type: "text", label: "File name", required: true, defaultValue: "notes.md" },
            },
          },
          {
            id: "delete",
            label: "Delete",
            icon: "Trash",
            commandId: "pstdio-planner.delete-ticket-file",
            args: { ticketId: ticket.id, fileId: file.id },
          },
        ],
      },
    ]);
  });

  test("marks the selected document so the host highlights it", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));
    const file = await createTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, name: "notes.md" } }),
    );

    await selectTicketDocumentCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, documentId: file.id } }),
    );

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-planner.ticketFiles",
          resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
        },
      }),
    );

    const allNodes = sections.flatMap((section) => section.nodes);
    expect(allNodes.find((node) => node.selected)?.id).toBe(file.id);
  });

  test("appends image attachments to the Files section and skips non-image attachments", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    const makeAttachment = (name: string, mimeType: string): StoredTicketAttachment => ({
      id: `att-${name}`,
      name,
      mimeType,
      size: 1,
      hash: "",
      url: `memory://${name}`,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    });

    await attachTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, ref: makeAttachment("diagram.png", "image/png") } }),
    );
    await attachTicketFileCommand.run(
      makeCommandContext({ storage, params: { ticketId: ticket.id, ref: makeAttachment("notes.txt", "text/plain") } }),
    );

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-planner.ticketFiles",
          resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
        },
      }),
    );
    const filesSection = sections.find((section) => section.id === "files");

    expect(filesSection?.nodes).toEqual([
      {
        id: "att-diagram.png",
        label: "diagram.png",
        icon: "Image",
        target: {
          kind: "command",
          commandId: "pstdio-planner.select-ticket-document",
          args: { ticketId: ticket.id, documentId: "att-diagram.png" },
        },
        selected: false,
      },
    ]);

    // Make sure the collection actually stored both attachments; only the image is surfaced.
    const stored = await ticketsCollection(storage).get(ticket.id);
    expect(stored?.attachments).toHaveLength(2);
  });
});

describe("ticket files tree workspace commands", () => {
  test("appends a Workspaces section for linked workspaces and excludes unrelated ones", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    const linked = {
      id: "ws-1",
      workspace_shorthand: "WS-1",
      anchors_json: [
        { type: "ticket", id: ticket.id, label: ticket.shorthand, metadata: { shorthand: ticket.shorthand } },
      ],
      branch: "feature/work",
      worktree_path: "/tmp/ws-1",
    };
    const unrelated = {
      id: "ws-2",
      workspace_shorthand: "WS-2",
      anchors_json: [{ type: "ticket", id: "other-ticket", label: "PS-999", metadata: { shorthand: "PS-999" } }],
    };

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-planner.ticketFiles",
          resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
        },
        overrides: { workspaces: { list: async () => [linked, unrelated] } },
      }),
    );

    expect(sections.map((section) => section.id)).toEqual(["ticket", "files", "workspaces"]);
    expect(sections[2]).toEqual({
      id: "workspaces",
      label: "Workspaces",
      collapsible: true,
      actions: [
        {
          id: "create-workspace",
          label: "Create workspace",
          icon: "Plus",
          commandId: "pstdio-planner.create-workspace",
          args: { ticket: ticket.id },
        },
      ],
      nodes: [
        {
          id: "workspace-ws-1",
          label: "WS-1",
          icon: "GitBranch",
          target: {
            kind: "resource",
            // Ticket metadata travels with the workspace so the dashboard nests its
            // breadcrumb under the ticket (Tickets / Ticket / Workspace).
            resource: {
              type: "workspace",
              id: "ws-1",
              label: "WS-1",
              metadata: {
                ticketId: ticket.id,
                ticketShorthand: ticket.shorthand,
                ticketLabel: `${ticket.shorthand} ${ticket.title}`,
                workspaceId: "ws-1",
                workspaceShorthand: "WS-1",
                workspaceType: "worktree",
              },
            },
          },
        },
      ],
    });
  });

  test("sorts linked workspaces by latest workspace activity before shorthand", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-planner.ticketFiles",
          resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
        },
        overrides: {
          workspaces: {
            list: async () => [
              {
                id: "ws-old",
                workspace_shorthand: "WS-1",
                anchors_json: [
                  { type: "ticket", id: ticket.id, label: ticket.shorthand, metadata: { shorthand: ticket.shorthand } },
                ],
                updated_at: "2026-01-01T00:00:00.000Z",
              },
              {
                id: "ws-new",
                workspace_shorthand: "WS-2",
                anchors_json: [
                  { type: "ticket", id: ticket.id, label: ticket.shorthand, metadata: { shorthand: ticket.shorthand } },
                ],
                updated_at: "2026-01-02T00:00:00.000Z",
              },
            ],
          },
        },
      }),
    );

    expect(sections[2]?.nodes.map((node) => node.id)).toEqual(["workspace-ws-new", "workspace-ws-old"]);
  });

  test("keeps the Workspaces section action and placeholder when no workspace is linked to the ticket", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Ticket" } }));

    const sections = await listTicketFilesTreeCommand.run(
      makeCommandContext({
        storage,
        params: {
          treeId: "pstdio-planner.ticketFiles",
          resource: { type: "ticket", id: ticket.id, label: ticket.shorthand },
        },
        overrides: {
          workspaces: {
            list: async () => [
              {
                id: "ws-2",
                anchors_json: [{ type: "ticket", id: "PS-999", label: "PS-999", metadata: { shorthand: "PS-999" } }],
              },
            ],
          },
        },
      }),
    );

    expect(sections.map((section) => section.id)).toEqual(["ticket", "files", "workspaces"]);
    expect(sections[2]).toMatchObject({
      id: "workspaces",
      label: "Workspaces",
      collapsible: true,
      actions: [
        {
          id: "create-workspace",
          label: "Create workspace",
          icon: "Plus",
          commandId: "pstdio-planner.create-workspace",
          args: { ticket: ticket.id },
        },
      ],
      nodes: [{ id: "workspaces-empty", label: "No workspaces", icon: "GitBranch", disabled: true }],
    });
  });
});
