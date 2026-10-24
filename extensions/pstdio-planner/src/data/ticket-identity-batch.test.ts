import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { resolveTicketResourcesCommand } from "../commands/resolve-ticket-resources";
import { ticketsCollection } from "./collections";

for (const surface of ["list", "resources"] as const) {
  test(`${surface} reads current identities in batches of at most 100`, async () => {
    const storage = createMemoryStorage();
    const ctx = makeCommandContext({ storage, params: {} });
    const records = storage.collection("tickets");
    const ids = Array.from({ length: 205 }, (_, index) => `ticket-${index}`);
    for (const id of ids) await records.put(id, { id, title: id });
    const batches: string[][] = [];
    ctx.resources.identity = async () => {
      throw new Error("A ticket list must batch its identity reads");
    };
    ctx.resources.identityMany = async ({ ids }) => {
      batches.push(ids);
      return ids.map((id) => ({ id, kind: "ticket", shorthand: `PS-${id.slice(7)}`, aliases: [] }));
    };

    const tickets =
      surface === "list"
        ? await ticketsCollection(ctx).list()
        : (await resolveTicketResourcesCommand.run(ctx, { resources: ids.map((id) => ({ type: "ticket", id })) })).map(
            (result) => result.resource,
          );

    expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5]);
    expect(tickets.map((ticket) => ticket.id)).toEqual(surface === "list" ? [...ids].sort() : ids);
    expect(tickets.find((ticket) => ticket.id === "ticket-204")?.shorthand).toBe("PS-204");
  });
}
