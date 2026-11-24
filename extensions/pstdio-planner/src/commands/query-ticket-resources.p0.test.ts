import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { archiveTicketCommand } from "./archive-ticket";
import { makeCommandArgs, makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { queryTicketResources } from "./query-ticket-resources";

test.each(["", "t-1 Active", "1 Act", "Active", "T-1"])("ticket search lists active tickets for %s", async (query) => {
  const storage = createMemoryStorage();
  if (query === "1 Act")
    for (let index = 0; index < 10; index++)
      await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Not Active" } }));
  await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Active" } }));
  const archived = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Archived" } }));
  await archiveTicketCommand.run(
    ...makeCommandArgs({ storage, params: {}, overrides: { resource: { type: "ticket", id: archived.id } } }),
  );

  const ctx = makeCommandContext({ storage, params: {} });
  const result = await queryTicketResources(ctx, {
    query,
    providerId: "tickets",
    limit: 1,
    renderer: { rendererId: "tickets" },
  });

  expect(result.items.map((item) => item.label)).toEqual([`${query === "1 Act" ? "T-11" : "T-1"} Active`]);
});
