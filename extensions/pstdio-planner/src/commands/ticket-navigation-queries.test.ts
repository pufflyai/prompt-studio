import { expect, test } from "bun:test";
import type { ExtensionSessionQuery } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { listTicketFilesTreeCommand } from "./ticket-files";

test("ticket navigation reads only its anchored session history", async () => {
  const storage = createMemoryStorage();
  const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Scoped history" } }));
  const queries: ExtensionSessionQuery[] = [];
  await listTicketFilesTreeCommand.run(
    ...makeCommandArgs({
      storage,
      params: { renderer: { rendererId: "ticket-files", resource: { type: "ticket", id: ticket.id } } },
      overrides: {
        sessions: {
          query: async (query) => {
            queries.push(query ?? {});
            return { items: [], nextCursor: null };
          },
        },
      },
    }),
  );
  expect(queries).toEqual([{ anchor: { type: "ticket", id: ticket.id }, limit: 200 }]);
});
