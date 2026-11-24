import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { queryTicketNavigationPage } from "../data/navigation-queries";
import { putTicket, ticketContext } from "../data/ticket-context.fixture";
import type { Ticket } from "../data/types";

test("a ticket with hundreds of prerequisites reads bodyless relationship pages", async () => {
  const storage = createMemoryStorage();
  const context = ticketContext(storage);
  const make = (id: string): Ticket => ({
    id,
    shorthand: `T-${id}`,
    title: id,
    content: "large body".repeat(1000),
    archived: false,
    statusId: "ready",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  });
  const ids = Array.from({ length: 203 }, (_, i) => String(i));
  for (const id of ids) await putTicket(storage, make(id));
  const root = { ...make("root"), dependsOn: ids };
  await putTicket(storage, root);
  const collection = storage.collection.bind(storage);
  storage.collection = <T>(name: string) => ({
    ...collection<T>(name),
    ...(name === "tickets"
      ? {
          get: async () => {
            throw new Error("Navigation read a ticket body");
          },
        }
      : {}),
  });
  const first = await queryTicketNavigationPage(context, root, "depends-on");
  expect(first.tickets).toHaveLength(100);
  expect(first.nextCursor).toBeString();
  const second = await queryTicketNavigationPage(context, root, "depends-on", first.nextCursor);
  expect(second.tickets).toHaveLength(100);
  const third = await queryTicketNavigationPage(context, root, "depends-on", second.nextCursor);
  expect(third.tickets).toHaveLength(3);
  expect(new Set([...first.tickets, ...second.tickets, ...third.tickets].map(({ id }) => id)).size).toBe(203);
});
