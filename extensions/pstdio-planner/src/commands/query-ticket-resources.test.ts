import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandArgs, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { queryTicketResources } from "./query-ticket-resources";

test("ticket search lists active tickets", async () => {
  const storage = createMemoryStorage();
  await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Active" } }));
  const archived = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Archived" } }));
  await archiveTicketCommand.run(
    ...makeCommandArgs({ storage, params: {}, overrides: { resource: { type: "ticket", id: archived.id } } }),
  );

  const ctx = makeCommandContext({ storage, params: {} });
  const result = await queryTicketResources(ctx, {
    query: "",
    providerId: "tickets",
    limit: 10,
    renderer: { rendererId: "tickets" },
  });

  expect(result.items.map((item) => item.label)).toEqual(["Active"]);
});
