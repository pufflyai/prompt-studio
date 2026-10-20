import { expect, test } from "bun:test";
import { createMemoryStorage, makeCommandContext } from "@pstdio/sdk/testing";
import { ticketsCollection } from "./collections";

test("ticket lists read current identities in batches of at most 100", async () => {
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

  const tickets = await ticketsCollection(ctx).list();

  expect(batches.map((batch) => batch.length)).toEqual([100, 100, 5]);
  expect(tickets.map((ticket) => ticket.id)).toEqual([...ids].sort());
  expect(tickets.find((ticket) => ticket.id === "ticket-204")?.shorthand).toBe("PS-204");
});
