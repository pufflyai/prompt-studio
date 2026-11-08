import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs, makeCommandContext } from "../commands/command-context.fixture";
import { createTicketCommand } from "../commands/create-ticket";
import { getTicketCommand } from "../commands/get-ticket";
import { ticketsCollection } from "./collections";

// Shared record text is materialized without running a provider's save callback.
test("ticket reads derive titles from canonical bodies on every lookup surface", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Initial ticket" } }));
  const ctx = makeCommandContext({ storage, params: {} });
  const records = storage.collection("tickets");
  const stored = (await records.get(ticket.id))!;
  await records.update(ticket.id, { ...stored, content: "# Shared title\n\nPeer ticket" });

  expect((await ticketsCollection(ctx).get(ticket.id))?.title).toBe("Shared title");
  expect((await ticketsCollection(ctx).getMany([ticket.id]))[0]?.title).toBe("Shared title");
  expect((await ticketsCollection(ctx).list())[0]?.title).toBe("Shared title");
  expect(await getTicketCommand.run(ctx, { id: ticket.shorthand })).toMatchObject({ title: "Shared title" });
  // Reading current titles must not create another record save or rewrite shared text.
  expect(await records.get(ticket.id)).toEqual({ ...stored, content: "# Shared title\n\nPeer ticket" });
});

test("a ticket created with a title keeps it until its body supplies a title", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Initial ticket" } }));
  const ctx = makeCommandContext({ storage, params: {} });
  expect(await ticketsCollection(ctx).get(ticket.id)).toMatchObject({ title: "Initial ticket", content: "" });
});
