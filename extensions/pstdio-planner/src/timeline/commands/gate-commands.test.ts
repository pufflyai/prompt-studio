import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { ticketsCollection } from "../../data/collections";
import { createGateCommand } from "./gate-commands";
import { gates } from "./gate-store";
import { launchGateCommand } from "./launch-gate";

test("preserves a gate ticket after failed registration and registers it on review retry", async () => {
  const storage = createMemoryStorage();
  const collection = storage.collection.bind(storage);
  let failed = false;
  storage.collection = ((name: string) => {
    const real = collection(name);
    if (name !== "timeline.agent-gates") return real;
    return {
      ...real,
      createIfAbsent: async (...args: Parameters<typeof real.createIfAbsent>) => {
        if (!failed) {
          failed = true;
          throw new Error("Storage unavailable");
        }
        return real.createIfAbsent(...args);
      },
    };
  }) as typeof storage.collection;
  const [ctx] = makeCommandArgs({
    storage,
    params: {},
    overrides: {
      sessions: {
        create: async () => ({
          id: "gate-session",
          title: "Gate review",
          type: "session" as const,
          status: "in_progress" as const,
        }),
      },
      navigation: { open: () => {} },
    },
  });
  const result = await createGateCommand.run(ctx, { content: "# Review the preview" });
  expect(result.launchError).toContain("Storage unavailable");
  expect(await ticketsCollection(storage).list()).toHaveLength(1);
  await launchGateCommand.run(ctx, { ticket: result.ticket.id });
  expect(await gates(ctx).get(result.ticket.id)).toEqual({ ticketId: result.ticket.id });
  expect(await ticketsCollection(storage).list()).toHaveLength(1);
});
