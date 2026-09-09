import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";

test("deleted tickets do not free identities and concurrent creates are distinct", async () => {
  const storage = createMemoryStorage();
  const create = () => createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Ticket" } }));
  const first = await create();
  await ticketsCollection(storage).delete(first.id);
  const second = await create();
  expect(second.shorthand).toBe("T-2");
  const tickets = await Promise.all(Array.from({ length: 10 }, create));
  expect(new Set(tickets.map((ticket) => ticket.shorthand)).size).toBe(10);
});
