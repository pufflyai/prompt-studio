import { describe, expect, test } from "bun:test";
import type { ResourceAnchor } from "@pstdio/sdk/extensions";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { seedDefaultStatuses } from "../data/seed";
import { seedTicketIdentity, ticketsCollection } from "../data/ticket-context.fixture";
import { ticketRecordId } from "../data/ticket-record-address";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { type ImportedTicket, importTicketsCommand } from "./import-tickets";

const importTickets = (
  storage: ReturnType<typeof createMemoryStorage>,
  tickets: ImportedTicket[],
  overrides: Parameters<typeof makeCommandArgs>[0]["overrides"] = {},
) => importTicketsCommand.run(...makeCommandArgs({ storage, params: { tickets }, overrides }));

const byPosition = <T extends { position?: string | null }>(tickets: T[]) =>
  tickets.toSorted((left, right) => ((left.position ?? "") < (right.position ?? "") ? -1 : 1));

describe("importTicketsCommand", () => {
  test("imports 250 tickets in order with parents and dependencies resolved by key", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const existing = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Existing" } }));
    const tickets: ImportedTicket[] = Array.from({ length: 250 }, (_, index) => ({
      key: `k${index}`,
      title: `Imported ${index}`,
      status: index % 2 ? "Done" : "Todo",
      ...(index % 10 ? { parent: `k${index - (index % 10)}` } : { parent: existing.id }),
      ...(index >= 5 ? { dependsOn: [`k${index - 5}`] } : {}),
    }));

    const result = await importTickets(storage, tickets);

    const ids = tickets.map(({ key }) => result.tickets[key]!.id);
    expect(new Set(ids).size).toBe(250);
    expect(new Set(tickets.map(({ key }) => result.tickets[key]!.shorthand)).size).toBe(250);
    const saved = await ticketsCollection(storage).list();
    expect(saved).toHaveLength(251);
    const imported = new Map(saved.map((ticket) => [ticket.id, ticket]));
    expect(imported.get(ids[13]!)).toMatchObject({
      title: "Imported 13",
      statusId: "done",
      parentId: ids[10],
      dependsOn: [ids[8]],
      archived: false,
    });
    expect(imported.get(ids[20]!)).toMatchObject({ statusId: "ready", parentId: existing.id });
    // Imported tickets follow the existing ticket in input order.
    expect(byPosition(saved).map(({ id }) => id)).toEqual([existing.id, ...ids]);
    // Each ticket is a record, not a collection item.
    expect((await storage.records.read(ticketRecordId(storage, ids[0]!))).value).toMatchObject({ title: "Imported 0" });
  });

  test("an unknown status or reference fails the whole import before anything is written", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await expect(
      importTickets(storage, [
        { key: "a", title: "A" },
        { key: "b", title: "B", status: "No such status" },
      ]),
    ).rejects.toThrow();
    await expect(importTickets(storage, [{ key: "a", title: "A", dependsOn: ["T-404"] }])).rejects.toThrow(
      'Unknown ticket "T-404"',
    );
    await expect(
      importTickets(storage, [
        { key: "a", title: "A" },
        { key: "a", title: "Again" },
      ]),
    ).rejects.toThrow('Ticket key "a" appears twice.');
    expect(await ticketsCollection(storage).list()).toEqual([]);
  });

  test("links each workspace to its imported tickets with one anchor update", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const calls: { id: string; anchors: ResourceAnchor[] }[] = [];
    const workspace = { id: "ws-1", workspace_shorthand: "WS-1" };
    const result = await importTickets(
      storage,
      [
        { key: "a", title: "A", links: [{ workspace: "WS-1" }] },
        { key: "b", title: "B", links: [{ workspace: "WS-1" }] },
        { key: "c", title: "C" },
      ],
      {
        workspaces: {
          getByShorthand: async (shorthand: string) => (shorthand === "WS-1" ? workspace : null),
          get: async () => null,
          addAnchors: async (id: string, anchors: ResourceAnchor[]) => {
            calls.push({ id, anchors });
          },
        } as never,
      },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]!.id).toBe("ws-1");
    expect(calls[0]!.anchors.map((anchor) => [anchor.id, anchor.role])).toEqual([
      [result.tickets.a!.id, "context"],
      [result.tickets.b!.id, "context"],
    ]);
  });

  test("tickets still in the old collection move before an import adds to them", async () => {
    const storage = createMemoryStorage({
      collections: { tickets: { legacy: { id: "legacy", title: "Legacy", content: "", position: "a0" } } },
    });
    seedTicketIdentity(storage, { id: "legacy", shorthand: "T-9" } as never);
    await seedDefaultStatuses(storage);
    const result = await importTickets(storage, [{ key: "new", title: "New", parent: "legacy" }]);

    expect((await storage.records.read(ticketRecordId(storage, "legacy"))).value).toMatchObject({ title: "Legacy" });
    expect((await ticketsCollection(storage).get(result.tickets.new!.id))?.parentId).toBe("legacy");
  });
});

describe("importTicketsCommand validation and failures", () => {
  test("rejects self-references and dependency or parent cycles before anything is written", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    for (const tickets of [
      [{ key: "a", title: "A", dependsOn: ["a"] }],
      [
        { key: "a", title: "A", dependsOn: ["b"] },
        { key: "b", title: "B", dependsOn: ["a"] },
      ],
      [
        { key: "a", title: "A", parent: "b" },
        { key: "b", title: "B", parent: "a" },
      ],
    ] satisfies ImportedTicket[][])
      await expect(importTickets(storage, tickets)).rejects.toThrow("cycle");
    await expect(importTickets(storage, [{ key: "a", title: "A", links: [{} as never] }])).rejects.toThrow(
      "exactly one workspace or session",
    );
    expect(await ticketsCollection(storage).list()).toEqual([]);
  });

  test("a failure after some groups still announces the saved tickets and says how many were saved", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    let commits = 0;
    const failing = {
      ...storage,
      records: {
        ...storage.records,
        commit: async (group: Parameters<typeof storage.records.commit>[0]) => {
          // The second group of imported tickets is refused.
          if (group.edits.length && ++commits === 2)
            return { operationId: group.operationId, state: "refused" as const, status: "saved-locally" as const };
          return storage.records.commit(group);
        },
      },
    } as typeof storage;
    const emitted: unknown[] = [];
    await expect(
      importTicketsCommand.run(
        ...makeCommandArgs({
          storage: failing,
          // The first ticket depends on the last, so the last must be saved first.
          params: {
            tickets: Array.from({ length: 150 }, (_, index) => ({
              key: `k${index}`,
              title: `T${index}`,
              ...(index === 0 ? { dependsOn: ["k149"] } : {}),
            })),
          },
          overrides: { events: { emit: async (event: unknown) => void emitted.push(event) } as never },
        }),
      ),
    ).rejects.toThrow("after saving 100 of 150 tickets");
    expect(emitted).toHaveLength(1);
    // The fixture keeps ticket numbers per storage object, so read through the importing one.
    const saved = await ticketsCollection(failing).list();
    expect(saved).toHaveLength(100);
    // No saved ticket points at a ticket that was not saved.
    const ids = new Set(saved.map(({ id }) => id));
    for (const ticket of saved) for (const dependency of ticket.dependsOn ?? []) expect(ids.has(dependency)).toBe(true);
  });
});

describe("importTicketsCommand input checks", () => {
  test("wrong field types, ambiguous links and records too large with their title fail before numbering", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    for (const ticket of [
      { key: "a", content: 123 },
      { key: "a", title: "A", dependsOn: "b" },
      { key: "a", title: "A", links: [{ workspace: "WS-1", session: "s" }] },
      // A single long line becomes the title too, which doubles the stored size.
      { key: "a", content: "x".repeat(150 * 1024) },
    ])
      await expect(importTickets(storage, [ticket as never])).rejects.toThrow();
    expect(await ticketsCollection(storage).list()).toEqual([]);
  });

  test("duplicate dependencies are stored once", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const result = await importTickets(storage, [
      { key: "a", title: "A" },
      { key: "b", title: "B", dependsOn: ["a", "a"] },
    ]);
    expect((await ticketsCollection(storage).get(result.tickets.b!.id))?.dependsOn).toEqual([result.tickets.a!.id]);
  });
});

test("tickets that name each other through parents and dependencies are never split across saves", async () => {
  const storage = createMemoryStorage();
  await seedDefaultStatuses(storage);
  const committed: number[] = [];
  let commits = 0;
  const failing = {
    ...storage,
    records: {
      ...storage.records,
      commit: async (group: Parameters<typeof storage.records.commit>[0]) => {
        if (group.edits.length) committed.push(group.edits.length);
        // The second group of imported tickets is refused.
        if (group.edits.length && ++commits === 2)
          return { operationId: group.operationId, state: "refused" as const, status: "saved-locally" as const };
        return storage.records.commit(group);
      },
    },
  } as typeof storage;
  // 60 independent tickets, then a 150-ticket parent chain that the last ticket's dependency closes.
  const tickets: ImportedTicket[] = [
    ...Array.from({ length: 60 }, (_, index) => ({ key: `free${index}`, title: `Free ${index}` })),
    ...Array.from({ length: 150 }, (_, index) => ({
      key: `c${index}`,
      title: `Chain ${index}`,
      ...(index < 149 ? { parent: `c${index + 1}` } : { dependsOn: ["c0"] }),
    })),
  ];
  await expect(importTicketsCommand.run(...makeCommandArgs({ storage: failing, params: { tickets } }))).rejects.toThrow(
    "stopped after saving",
  );

  // The 150-ticket component went into one save of its own.
  expect(committed).toContain(150);
  const saved = await ticketsCollection(failing).list();
  const ids = new Set(saved.map(({ id }) => id));
  for (const ticket of saved) {
    if (ticket.parentId) expect(ids.has(ticket.parentId)).toBe(true);
    for (const dependency of ticket.dependsOn ?? []) expect(ids.has(dependency)).toBe(true);
  }
});
