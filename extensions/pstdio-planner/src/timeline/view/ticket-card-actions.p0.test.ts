import { describe, expect, test } from "bun:test";
import type { GuestHost, WebviewResourceAction } from "@pstdio/sdk/extensions";
import { createTicketCardActions } from "./ticket-card-actions";

interface PendingList {
  params: { resource: { id: string } };
  resolve: (actions: WebviewResourceAction[]) => void;
  reject: (reason: unknown) => void;
}

// Each list stays pending until the test answers it, so tests control arrival order.
const createHost = () => {
  const listeners = new Set<(payload: unknown) => void>();
  const lists: PendingList[] = [];
  const host = {
    extensionId: "pstdio.pstdio-planner",
    call: ((method: string, params: PendingList["params"]) => {
      if (method !== "resources.actions") throw new Error(`Unexpected ${method}`);
      return new Promise<WebviewResourceAction[]>((resolve, reject) => lists.push({ params, resolve, reject }));
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
const actions = (label: string) => [{ key: label, label }];
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

const createCard = (host: ReturnType<typeof createHost>["host"]) => {
  const shown: string[] = [];
  const errors: string[] = [];
  const card = createTicketCardActions(host, {
    onActions: (listed) => shown.push(listed.map(({ label }) => label).join()),
    onError: (reason) => errors.push(String(reason)),
  });
  return { card, shown, errors };
};

describe("timeline ticket card actions", () => {
  test("host changes never make drawn cards list again until someone uses one", async () => {
    const { host, lists, emitChanged } = createHost();
    const cards = Array.from({ length: 40 }, (_, index) => {
      const { card } = createCard(host);
      card.load(ticket(`t${index}`));
      card.load(ticket(`t${index}`));
      return card;
    });
    expect(lists).toHaveLength(40);
    for (const list of lists) list.resolve(actions("run"));

    for (let change = 0; change < 25; change++) emitChanged();
    await settle();

    expect(lists).toHaveLength(40);
    cards[0]!.refresh(ticket("t0"));
    expect(lists).toHaveLength(41);
    for (const card of cards) card.dispose();
  });

  test("using a card lists again only after a change", async () => {
    const { host, lists, emitChanged } = createHost();
    const { card, shown } = createCard(host);

    card.load(ticket("t1"));
    lists[0]!.resolve(actions("run"));
    await settle();
    card.refresh(ticket("t1"));
    expect(lists).toHaveLength(1);

    emitChanged();
    card.refresh(ticket("t1"));
    card.refresh(ticket("t1"));
    lists[1]!.resolve(actions("run,review"));
    await settle();

    expect(lists).toHaveLength(2);
    expect(shown).toEqual(["run", "run,review"]);
    card.dispose();
  });

  test("a list that was in flight during a change still shows, and the next use lists again", async () => {
    const { host, lists, emitChanged } = createHost();
    const { card, shown } = createCard(host);

    card.refresh(ticket("t1"));
    emitChanged();
    lists[0]!.resolve(actions("run"));
    await settle();
    expect(shown).toEqual(["run"]);

    card.refresh(ticket("t1"));
    expect(lists).toHaveLength(2);
    card.dispose();
  });

  test("only the newest list reaches the card, whatever order the answers arrive in", async () => {
    const { host, lists, emitChanged } = createHost();
    const { card, shown, errors } = createCard(host);

    card.refresh(ticket("t1"));
    emitChanged();
    card.refresh(ticket("t1"));
    card.refresh(ticket("t2"));
    lists[2]!.resolve(actions("t2"));
    lists[0]!.reject(new Error("old failure"));
    lists[1]!.resolve(actions("t1"));
    await settle();

    expect(lists.map(({ params }) => params.resource.id)).toEqual(["t1", "t1", "t2"]);
    expect(shown).toEqual(["t2"]);
    expect(errors).toEqual([]);
    card.dispose();
  });

  test("a failed list is reported and the next use tries again", async () => {
    const { host, lists } = createHost();
    const { card, shown, errors } = createCard(host);

    card.load(ticket("t1"));
    lists[0]!.reject(new Error("host unavailable"));
    await settle();
    expect(errors).toEqual(["Error: host unavailable"]);

    card.refresh(ticket("t1"));
    lists[1]!.resolve(actions("run"));
    await settle();
    expect(shown).toEqual(["run"]);
    card.dispose();
  });

  test("a removed card stops listening for changes", () => {
    const { host, listeners } = createHost();
    const { card } = createCard(host);

    card.dispose();

    expect(listeners.size).toBe(0);
  });
});
