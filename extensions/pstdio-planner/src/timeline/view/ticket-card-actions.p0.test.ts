import { describe, expect, test } from "bun:test";
import type { GuestHost } from "@pstdio/sdk/extensions";
import { createTicketCardActions } from "./ticket-card-actions";

const createHost = () => {
  const listeners = new Set<(payload: unknown) => void>();
  const lists: unknown[] = [];
  const host = {
    extensionId: "pstdio.pstdio-planner",
    call: (async (method: string, params: unknown) => {
      if (method !== "resources.actions") throw new Error(`Unexpected ${method}`);
      lists.push(params);
      return [{ key: "run", label: "Run attempt" }];
    }) as GuestHost["call"],
    onEvent: (scope: string, listener: (payload: unknown) => void) => {
      if (scope !== "resources.actions") throw new Error(`Unexpected ${scope}`);
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  } satisfies GuestHost;
  const emitChanged = () => {
    for (const listener of listeners) listener({ type: "changed" });
  };
  return { host, lists, listeners, emitChanged };
};

const ticket = (id: string) => ({ type: "ticket", id, extensionId: "pstdio.pstdio-planner" });
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("timeline ticket card actions", () => {
  test("cards nobody touches never list their actions, however often the host reports changes", async () => {
    const { host, lists, emitChanged } = createHost();
    const cards = Array.from({ length: 40 }, () => createTicketCardActions(host, { onActions: () => {} }));

    for (let change = 0; change < 25; change++) emitChanged();
    await settle();

    expect(lists).toHaveLength(0);
    for (const card of cards) card.dispose();
  });

  test("a card lists its actions once when it is about to be used, and again only after a change", async () => {
    const { host, lists, emitChanged } = createHost();
    const loaded: unknown[] = [];
    const card = createTicketCardActions(host, { onActions: (actions) => loaded.push(actions) });

    card.prepare(ticket("t1"));
    card.prepare(ticket("t1"));
    await settle();
    expect(lists).toEqual([{ operation: "list", resource: ticket("t1") }]);
    expect(loaded).toEqual([[{ key: "run", label: "Run attempt" }]]);

    emitChanged();
    emitChanged();
    await settle();
    expect(lists).toHaveLength(1);

    card.prepare(ticket("t1"));
    await settle();
    expect(lists).toHaveLength(2);
    card.dispose();
  });

  test("a card shows the actions of the ticket it currently draws", async () => {
    const { host, lists } = createHost();
    const card = createTicketCardActions(host, { onActions: () => {} });

    card.prepare(ticket("t1"));
    await settle();
    card.prepare(ticket("t2"));
    await settle();

    expect(lists).toEqual([
      { operation: "list", resource: ticket("t1") },
      { operation: "list", resource: ticket("t2") },
    ]);
    card.dispose();
  });

  test("a removed card stops listening for changes", () => {
    const { host, listeners } = createHost();
    const card = createTicketCardActions(host, { onActions: () => {} });

    card.dispose();

    expect(listeners.size).toBe(0);
  });
});
