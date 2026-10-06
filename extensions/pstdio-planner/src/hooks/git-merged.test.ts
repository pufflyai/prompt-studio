import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs, makeCommandContext } from "../commands/command-context.fixture";
import { createTicketCommand } from "../commands/create-ticket";
import { statusesCollection, ticketsCollection } from "../data/collections";
import { gitMergedHook } from "./git-merged";

for (const scenario of ["merged", "disabled", "archived", "done"]) {
  test(`local merge: ${scenario}`, async () => {
    const storage = createMemoryStorage();
    await statusesCollection(storage).put("done", { id: "done", name: "Done" } as never);
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Merge" } }));
    const stored = {
      ...ticket,
      archived: scenario === "archived",
      statusId: scenario === "done" ? "done" : ticket.statusId,
    };
    await ticketsCollection(storage).put(ticket.id, stored);
    const emissions: unknown[] = [];
    const ctx = makeCommandContext({
      storage,
      params: {},
      overrides: {
        settings: { get: async () => scenario !== "disabled" },
        events: {
          emit: async (_event, payload) => {
            emissions.push(payload);
            return {} as never;
          },
        },
      },
    });
    await gitMergedHook.run(ctx as never, { projectId: ctx.projectId, anchors: [{ type: "ticket", id: ticket.id }] });
    expect((await ticketsCollection(storage).get(ticket.id))?.statusId).toBe(
      scenario === "merged" ? "done" : stored.statusId,
    );
    expect(emissions.length).toBe(scenario === "merged" ? 1 : 0);
  });
}
