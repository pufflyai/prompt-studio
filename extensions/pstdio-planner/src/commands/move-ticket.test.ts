import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { seedDefaultStatuses } from "../data/seed";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { moveTicket } from "./move-ticket";

test("saves destination attributes and manual placement from one board drop", async () => {
  const storage = createMemoryStorage();
  await seedDefaultStatuses(storage);
  const first = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
  const second = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Second" } }));
  const [ctx] = makeCommandArgs({ storage, params: {} });
  await moveTicket(ctx, { rowId: second.id, attributes: { status: "done" }, order: { beforeRowId: first.id } });
  expect(await ticketsCollection(storage).get(second.id)).toMatchObject({ statusId: "done", sortOrder: 0 });
});
