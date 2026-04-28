import { describe, expect, it } from "bun:test";
import { pullTickets } from "./ticket-pull";

describe("pullTickets", () => {
  it("delegates pulling to the planner command", async () => {
    const calls: unknown[] = [];
    const logs: string[] = [];
    const ctx = {
      projectId: "proj-1",
      client: {
        extensionCommands: {
          execute: async (_projectId: string, commandId: string, input: unknown) => {
            calls.push({ commandId, input });
            return {
              pulled_ticket_shorthands: ["PS-1"],
              downloaded_file_count: 1,
              messages: ["Pulled ticket PS-1"],
            };
          },
        },
      },
    } as never;

    const result = await pullTickets(ctx, {
      rootPath: "/repo",
      ticketId: "PS-1",
      force: true,
      log: (message) => logs.push(message),
    });

    expect(result).toEqual({ pulledTicketShorthands: ["PS-1"], downloadedFileCount: 1 });
    expect(logs).toEqual(["Pulled ticket PS-1"]);
    expect(calls).toEqual([
      {
        commandId: "pstdio.planner.pullTickets",
        input: {
          params: {
            ticket_id: "PS-1",
            repo_path: "/repo",
            force: true,
          },
        },
      },
    ]);
  });
});
