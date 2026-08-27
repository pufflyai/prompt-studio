import { describe, expect, mock, test } from "bun:test";
import { createMemoryStorage } from "../data/memory-storage";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { ticketWorktreesRemoveAllCommand } from "./ticket-workspaces";

describe("ticketWorktreesRemoveAllCommand", () => {
  test("uses workspace lifecycle cleanup and preserves workspace records", async () => {
    const storage = createMemoryStorage();
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Cleanup" } }));
    const removeWorktree = mock(async () => ({ removed: true }));

    const result = await ticketWorktreesRemoveAllCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id },
        overrides: {
          workspaces: {
            list: async () => [
              {
                id: "workspace-1",
                workspace_shorthand: `${ticket.shorthand}_A1`,
                worktree_path: "/repo/.pstdio/workspaces/one",
                anchors_json: [{ type: "ticket", id: ticket.id, label: ticket.shorthand }],
              },
            ],
            removeWorktree,
          },
        },
      }),
    );

    expect(result).toEqual({ removed: 1 });
    expect(removeWorktree).toHaveBeenCalledWith("workspace-1");
  });
});
