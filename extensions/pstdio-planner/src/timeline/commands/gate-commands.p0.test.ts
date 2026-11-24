import { expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { makeCommandArgs } from "../../commands/command-context.fixture";
import { createTicketCommand } from "../../commands/create-ticket";
import { sessionRecord } from "../../commands/session-record.fixture";
import { ticketsCollection } from "../../data/ticket-context.fixture";

import { createGateCommand } from "./gate-commands";
import { gates } from "./gate-store";
import { launchGateCommand } from "./launch-gate";

test.each(["id", "shorthand"] as const)("archived tickets cannot launch a gate review by %s", async (identity) => {
  const storage = createMemoryStorage();
  const effects: string[] = [];
  const [ctx] = makeCommandArgs({
    storage,
    params: {},
    overrides: {
      sessions: {
        create: async () => {
          effects.push("session");
          return sessionRecord({ id: "unexpected", title: "Review", status: "in_progress" });
        },
      },
      navigation: {
        open: () => {
          effects.push("navigation");
        },
      },
    },
  });
  const ticket = await createTicketCommand.run(ctx, { title: "Archived unfinished work" });
  await ticketsCollection(storage).put(ticket.id, { ...ticket, archived: true });

  await expect(launchGateCommand.run(ctx, { ticket: ticket[identity] })).rejects.toThrow("Unknown ticket");
  expect(await gates(ctx).get(ticket.id)).toBeUndefined();
  expect(effects).toEqual([]);
});

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
        create: async () =>
          sessionRecord({
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
