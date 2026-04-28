import { describe, expect, it } from "bun:test";
import { saveTicket } from "./save-ticket";

const ctxWithTicket = (calls: unknown[]) =>
  ({
    projectId: "proj-1",
    client: {
      extensions: {
        listCollection: async () => [
          {
            item_id: "ticket-1",
            project_id: "proj-1",
            value_json: { id: "ticket-1", shorthand: "PS-1" },
            created_at: "created",
            updated_at: "updated",
          },
        ],
      },
      extensionCommands: {
        execute: async (_projectId: string, commandId: string, input: unknown) => {
          calls.push({ commandId, input });
          return {
            ticket_id: "PS-1",
            uploaded_file_count: 2,
            messages: ["Saved ticket PS-1", "Uploaded 2 ticket files"],
          };
        },
      },
    },
  }) as never;

describe("saveTicket", () => {
  it("delegates saving to the planner command", async () => {
    const calls: unknown[] = [];
    const logs: string[] = [];

    const result = await saveTicket(ctxWithTicket(calls), {
      rootPath: "/repo",
      ticketId: "PS-1",
      status: "wip",
      tags: ["bug"],
      log: (message) => logs.push(message),
    });

    expect(result).toEqual({ ticketShorthand: "PS-1", uploadedFileCount: 2 });
    expect(logs).toEqual(["Saved ticket PS-1", "Uploaded 2 ticket files"]);
    expect(calls).toEqual([
      {
        commandId: "pstdio.planner.saveTicket",
        input: {
          params: {
            ticket_id: "PS-1",
            repo_path: "/repo",
            status: "wip",
            tags: ["bug"],
          },
        },
      },
    ]);
  });

  it("throws when the ticket cannot be resolved", async () => {
    const ctx = {
      projectId: "proj-1",
      client: {
        extensions: {
          listCollection: async () => [],
        },
      },
    } as never;

    await expect(saveTicket(ctx, { rootPath: "/repo", ticketId: "PS-99" })).rejects.toThrow("Ticket not found: PS-99");
  });
});
