import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { deleteTicketCommand } from "./delete-ticket";

for (const command of [archiveTicketCommand, deleteTicketCommand]) {
  for (const scenario of ["unused", "disabled", "shared", "default", "unsupported", "missing ticket", "failure"]) {
    test(`${command.id} workspace cleanup: ${scenario}`, async () => {
      const storage = createMemoryStorage();
      const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Cleanup" } }));
      const other = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Active" } }));
      const deleted: string[] = [];
      const notifications: unknown[] = [];
      const anchors = [{ type: "ticket", id: ticket.id, shorthand: ticket.shorthand }];
      if (scenario === "shared") anchors.push({ type: "ticket", id: other.id, shorthand: other.shorthand });
      if (scenario === "missing ticket") anchors.push({ type: "ticket", id: "missing", shorthand: "T-999" });
      await command.run(
        ...makeCommandArgs({
          storage,
          params: {},
          overrides: {
            resource: { type: "ticket", id: ticket.id },
            settings: { get: async () => scenario !== "disabled" },
            workspaces: {
              list: async () => [
                {
                  id: "workspace",
                  anchors_json: anchors,
                  is_default: scenario === "default",
                  provider_capabilities_json: {
                    files: "write",
                    diff: true,
                    merge: true,
                    rebase: true,
                    archive: false,
                    delete: scenario !== "unsupported",
                  },
                },
              ],
              delete: async (id) => {
                deleted.push(id);
                if (scenario === "failure") throw new Error("Cannot delete");
              },
            },
            notify: {
              action: async (notification: unknown) => {
                notifications.push(notification);
              },
            } as never,
          },
        }),
      );
      expect(deleted).toEqual(["unused", "missing ticket", "failure"].includes(scenario) ? ["workspace"] : []);
      expect(notifications.length).toBe(scenario === "failure" ? 1 : 0);
      const stored = await ticketsCollection(storage).get(ticket.id);
      if (command === archiveTicketCommand) expect(stored?.archived).toBe(true);
      else expect(stored).toBeUndefined();
    });
  }
}
