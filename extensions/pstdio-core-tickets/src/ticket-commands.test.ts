import { describe, expect, test } from "bun:test";
import { ticketBoardCommands, ticketDocumentCommands, ticketStatusCommands } from "./ticket-commands";

describe("pstdio-core-tickets ticket board commands", () => {
  test("ticketBoard.read returns tickets and ticket statuses for the extension webview", async () => {
    const tickets = [
      {
        id: "ticket-1",
        shorthand: "PS-304",
        display_title: "Move tickets",
        status_name: "ready",
        tag_ids: ["tag-1"],
        tag_names: ["ui"],
        updated_at: "2026-05-27T10:00:00.000Z",
      },
    ];
    const statuses = [
      {
        id: "status-ready",
        name: "ready",
        color: "green",
        sortOrder: 20,
        isDefault: false,
        canCreate: false,
        canDragIn: true,
        canDragOut: true,
        columnActions: [],
      },
    ];

    const result = await ticketBoardCommands["ticketBoard.read"].run({
      params: {},
      tickets: {
        list: async (input: unknown) => {
          expect(input).toEqual({ archived: false });
          return tickets;
        },
      },
      ticketStatuses: {
        list: async () => statuses,
      },
    } as never);

    expect(result).toEqual({ statuses, tickets });
  });
});

describe("pstdio-core-tickets status commands", () => {
  test("ticketStatus.read returns ticket statuses from the host", async () => {
    const statuses = [
      {
        id: "status-done",
        name: "done",
        color: "green",
        sortOrder: 60,
        isDefault: false,
        canCreate: false,
        canDragIn: true,
        canDragOut: true,
        columnActions: ["archive_all"],
      },
    ];

    const result = await ticketStatusCommands["ticketStatus.read"].run({
      params: {},
      ticketStatuses: {
        list: async () => statuses,
      },
    } as never);

    expect(result).toEqual({ statuses });
  });

  test("ticketStatus.update persists column action controls", async () => {
    const updates: unknown[] = [];

    await ticketStatusCommands["ticketStatus.update"].run({
      params: {
        statusId: "status-done",
        canCreate: false,
        canDragIn: true,
        canDragOut: true,
        columnActions: ["archive_all"],
      },
      ticketStatuses: {
        update: async (input: unknown) => {
          updates.push(input);
          return { id: "status-done" };
        },
      },
    } as never);

    expect(updates).toEqual([
      {
        statusId: "status-done",
        canCreate: false,
        canDragIn: true,
        canDragOut: true,
        columnActions: ["archive_all"],
      },
    ]);
  });
});

describe("pstdio-core-tickets document commands", () => {
  test("ticketDocument.read returns every ticket file with the ticket content active", async () => {
    const reads: string[] = [];

    const result = await ticketDocumentCommands["ticketDocument.read"].run({
      params: {},
      resource: {
        type: "ticket",
        id: "ticket-1",
        label: "PS-304",
        metadata: { shorthand: "PS-304" },
      },
      tickets: {
        get: async (ref: string) => {
          expect(ref).toBe("PS-304");
          return {
            id: "ticket-1",
            shorthand: "PS-304",
            display_title: "Move tickets",
            file_id: "file-ticket",
            status_name: "wip",
            tag_names: ["P2", "Bug"],
            updated_at: "2026-05-28T10:00:00.000Z",
          };
        },
        listFiles: async (ref: string) => {
          expect(ref).toBe("ticket-1");
          return [
            { id: "file-notes", file_name: "notes.md", file_kind: "attachment", mime_type: "text/markdown" },
            { id: "file-ticket", file_name: "ticket.md", file_kind: "ticket_content", mime_type: "text/markdown" },
          ];
        },
      },
      files: {
        readText: async (fileId: string) => {
          reads.push(fileId);
          return fileId === "file-ticket" ? "# Move tickets" : "Extra notes";
        },
      },
    } as never);

    expect(reads).toEqual(["file-ticket", "file-notes"]);
    expect(result).toEqual({
      title: "PS-304 Move tickets",
      activeFileId: "file-ticket",
      properties: [
        { id: "shorthand", label: "Ticket", value: "PS-304" },
        { id: "status", label: "Status", value: "wip" },
        { id: "tags", label: "Tags", value: "P2, Bug" },
        { id: "updated", label: "Updated", value: "2026-05-28T10:00:00.000Z" },
      ],
      files: [
        {
          id: "file-ticket",
          name: "ticket.md",
          content: "# Move tickets",
          language: "markdown",
          mimeType: "text/markdown",
          editable: true,
        },
        {
          id: "file-notes",
          name: "notes.md",
          content: "Extra notes",
          language: "markdown",
          mimeType: "text/markdown",
          editable: true,
        },
      ],
    });
  });

  test("ticketDocument.update saves ticket content through tickets and attachments through files", async () => {
    const ticketUpdates: unknown[] = [];
    const fileWrites: unknown[] = [];
    const baseContext = {
      resource: {
        type: "ticket",
        id: "ticket-1",
        label: "PS-304",
        metadata: { shorthand: "PS-304" },
      },
      tickets: {
        get: async () => ({
          id: "ticket-1",
          shorthand: "PS-304",
          display_title: "Move tickets",
          file_id: "file-ticket",
        }),
        update: async (input: unknown) => {
          ticketUpdates.push(input);
          return { id: "ticket-1" };
        },
      },
      files: {
        writeText: async (fileId: string, content: string) => {
          fileWrites.push({ fileId, content });
        },
      },
    };

    await ticketDocumentCommands["ticketDocument.update"].run({
      ...baseContext,
      params: { fileId: "file-ticket", content: "# Updated ticket" },
    } as never);
    await ticketDocumentCommands["ticketDocument.update"].run({
      ...baseContext,
      params: { fileId: "file-notes", content: "Updated notes" },
    } as never);

    expect(ticketUpdates).toEqual([{ ticket: "PS-304", content: "# Updated ticket" }]);
    expect(fileWrites).toEqual([{ fileId: "file-notes", content: "Updated notes" }]);
  });
});
