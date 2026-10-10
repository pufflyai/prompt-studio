import { expect, test } from "bun:test";
import type { NavigationTarget } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { makeCommandArgs } from "./command-context.fixture";
import { newTicketCommand } from "./new-ticket";

test("creates a ticket from its form and opens the new ticket", async () => {
  const storage = createMemoryStorage();
  const destinations: NavigationTarget[] = [];
  const ticket = await newTicketCommand.run(
    ...makeCommandArgs({
      storage,
      params: { content: "# Shortcut ticket\n\nCreated from the form." },
      overrides: {
        navigation: {
          open: (target) => {
            destinations.push(target);
          },
        },
      },
    }),
  );
  expect(await ticketsCollection(storage).list()).toMatchObject([{ id: ticket.id, title: "Shortcut ticket" }]);
  expect(destinations).toMatchObject([{ kind: "page", page: { id: "ticket" }, resource: { id: ticket.id } }]);
});
