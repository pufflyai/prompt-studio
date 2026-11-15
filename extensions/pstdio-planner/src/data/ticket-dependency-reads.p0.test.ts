import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { putTicket, ticketContext } from "./ticket-context.fixture";
import { readTicketDependencyClosure } from "./ticket-dependency-reads";

test("dependency traversal reads bounded metadata frontiers without dependency bodies", async () => {
  const storage = createMemoryStorage();
  const ids = Array.from({ length: 203 }, (_, i) => String(i));
  const base = {
    content: "Body ".repeat(1000),
    statusId: "ready",
    archived: false,
    sortOrder: 0,
    createdAt: "before",
    updatedAt: "after",
  };
  for (const id of [...ids, "unrelated", "root"])
    await putTicket(storage, { ...base, id, shorthand: `T-${id}`, title: id, dependsOn: id === "root" ? ids : [] });
  const ctx = ticketContext(storage);
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    get: async (id: string) => {
      if (name === "tickets" && id !== "root") throw Error("Dependency body read");
      return collection<T>(name).get(id);
    },
    list: async () => {
      throw Error("Unbounded read");
    },
  });
  const closure = await readTicketDependencyClosure(ctx, "root");
  expect(closure.tickets).toHaveLength(204);
  expect(closure.tickets.some(({ id }) => id === "unrelated")).toBe(false);
});
