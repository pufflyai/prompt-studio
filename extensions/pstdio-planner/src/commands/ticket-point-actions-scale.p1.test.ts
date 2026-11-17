import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { seedTicketIdentity } from "../data/ticket-context.fixture";
import { validateTicketDependencies } from "../data/ticket-dependencies";
import type { Ticket } from "../data/types";
import { makeCommandArgs, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { reorderTicket } from "./reorder-ticket";

test("create, reorder and cycle checks do not read a complete ticket collection", async () => {
  const rows: Ticket[] = Array.from({ length: 5000 }, (_, index) => ({
    id: `ticket-${String(index).padStart(4, "0")}`,
    shorthand: `T-${index + 1}`,
    title: `Ticket ${index}`,
    content: "Body ".repeat(1000),
    statusId: "backlog",
    archived: false,
    tags: {},
    position: `${(index + 1).toString(16).padStart(14, "0")}1`,
    createdAt: "2026-11-14",
    updatedAt: "2026-11-14",
  }));
  const storage = createMemoryStorage({
    collections: { tickets: Object.fromEntries(rows.map((row) => [row.id, row])) },
  });
  for (const row of rows) seedTicketIdentity(storage, row);
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => {
    const records = collection<T>(name);
    if (name === "tickets")
      records.list = async () => {
        throw Error("Full ticket collection read");
      };
    return records;
  };
  const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "New ticket" } }));
  expect(created.position! > rows.at(-1)!.position!).toBe(true);
  const ctx = makeCommandContext({ storage, params: {} });
  await reorderTicket(ctx, { rowId: rows[1].id, beforeRowId: rows[0].id });
  const moved = await collection<Ticket>("tickets").get(rows[1].id);
  expect(moved!.position! < rows[0].position!).toBe(true);
  await validateTicketDependencies(ctx, rows[0], [rows[1].id]);
  await collection<Ticket>("tickets").put(rows[1].id, { ...rows[1], dependsOn: [rows[0].id] });
  await expect(validateTicketDependencies(ctx, rows[0], [rows[1].id])).rejects.toThrow("dependency cycle");
});
