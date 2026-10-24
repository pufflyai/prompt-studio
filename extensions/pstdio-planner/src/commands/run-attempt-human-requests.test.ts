import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { listTicketReviewRequests } from "../data/review-request-storage";
import { seedDefaultTags } from "../data/seed";
import { ticketsCollection } from "../data/ticket-context.fixture";
import { createSessionResource, makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { runAttemptCommand } from "./run-attempt";

describe("runAttemptCommand human requests", () => {
  const ticketWithDeletedDependency = async () => {
    const storage = createMemoryStorage();
    await seedDefaultTags(storage);
    const dependency = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const ticket = await createTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Second", dependsOn: [dependency.shorthand] } }),
    );
    await ticketsCollection(storage).delete(dependency.id);
    return { storage, ticket };
  };

  test("asks a person to fix a dependency that no longer exists", async () => {
    const { storage, ticket } = await ticketWithDeletedDependency();

    await expect(
      runAttemptCommand.run(
        ...makeCommandArgs({
          storage,
          params: { ticket: ticket.shorthand },
          overrides: { sessions: { create: async () => createSessionResource() } as never },
        }),
      ),
    ).rejects.toThrow(ticket.shorthand);
    expect((await listTicketReviewRequests(storage, ticket.id)).requests).toEqual([
      expect.objectContaining({ context: expect.objectContaining({ reason: "dependency-missing" }), state: "open" }),
    ]);
  });

  test("still reports why the ticket cannot start when the human request fails", async () => {
    const { storage, ticket } = await ticketWithDeletedDependency();

    const run = runAttemptCommand.run(
      ...makeCommandArgs({
        storage,
        params: { ticket: ticket.shorthand },
        overrides: {
          sessions: {
            create: async () => {
              throw new Error("No default agent is configured.");
            },
          } as never,
        },
      }),
    );

    await expect(run).rejects.toThrow(`${ticket.shorthand} can't start`);
  });
});
