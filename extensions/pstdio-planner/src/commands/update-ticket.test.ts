import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { ticketsCollection } from "../data/collections";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { plannerTicketsChanged } from "../events";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { getTicketCommand } from "./get-ticket";
import { updateTicketCommand } from "./update-ticket";

describe("get/update ticket commands", () => {
  test("publishes the saved ticket change so other clients can refresh", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Original" } }));
    const events: unknown[] = [];

    await updateTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: created.shorthand, content: "# Updated" },
        overrides: {
          events: {
            emit: async (event, payload) => {
              expect(await ticketsCollection(storage).get(created.id)).toMatchObject({ title: "Updated" });
              events.push({ event, payload });
              return { delivered: 0 };
            },
          },
        },
      }),
    );

    expect(events).toEqual([{ event: plannerTicketsChanged, payload: { ticketId: created.id } }]);
  });

  test("getTicket returns the stored ticket or null", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "X" } }));

    const found = await getTicketCommand.run(...makeCommandArgs({ storage, params: { id: created.id } }));
    const missing = await getTicketCommand.run(...makeCommandArgs({ storage, params: { id: "nope" } }));

    expect(found?.id).toBe(created.id);
    expect(missing).toBeNull();
  });

  test("updateTicket re-derives the title from the saved content", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(
      ...makeCommandArgs({ storage, params: { content: "# Original\n\nold" } }),
    );
    expect(created.title).toBe("Original");

    const updated = await updateTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: created.id, content: "# Renamed\n\nnew body" } }),
    );

    expect(updated?.content).toBe("# Renamed\n\nnew body");
    expect(updated?.title).toBe("Renamed");

    const persisted = await ticketsCollection(storage).get(created.id);
    expect(persisted?.content).toBe("# Renamed\n\nnew body");
  });

  test("updateTicket throws for an unknown ticket", async () => {
    const storage = createMemoryStorage();
    await expect(
      updateTicketCommand.run(...makeCommandArgs({ storage, params: { id: "missing", content: "x" } })),
    ).rejects.toThrow(/Unknown ticket "missing"/);
  });
});

describe("updateTicket server-side resolution", () => {
  test("resolves status name, tag names, and parent shorthand", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedDefaultTags(storage);
    const parent = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Parent" } }));
    const child = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Child" } }));

    const updated = await updateTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: child.shorthand, status: "In Progress", tags: ["High"], parent: parent.shorthand },
      }),
    );

    expect(updated?.statusId).toBe("in-progress");
    expect(updated?.tagIds).toEqual(["default-priority-high"]);
    expect(updated?.parentId).toBe(parent.id);
  });

  test("unlinks the parent and sets a blocked reason", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const parent = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Parent" } }));
    const child = await createTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Child", parentId: parent.id } }),
    );
    expect(child.parentId).toBe(parent.id);

    const updated = await updateTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: child.id, unlinkParent: true, blockedReason: "waiting on infra" } }),
    );

    expect(updated?.parentId).toBeNull();
    expect(updated?.blockedReason).toBe("waiting on infra");
  });

  test("emits and resolves blocked ticket notifications", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Blocked" } }));
    const notifications: unknown[] = [];
    const resolutions: unknown[] = [];
    const overrides = {
      notify: {
        action: async (input: unknown) => {
          notifications.push(input);
          return {};
        },
        resolve: async (input: unknown) => {
          resolutions.push(input);
          return [];
        },
      } as never,
    };

    await updateTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: ticket.id, blockedReason: "need credentials" }, overrides }),
    );
    await updateTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: ticket.id, status: "In Progress", blockedReason: "" }, overrides }),
    );

    expect(notifications).toEqual([
      expect.objectContaining({
        dedupeKey: "pstdio-planner:ticket:T-1:blocked",
        kind: "blocked",
        priority: "high",
      }),
    ]);
    expect(resolutions).toEqual([{ dedupeKey: "pstdio-planner:ticket:T-1:blocked", status: "done" }]);
  });

  test("returns the saved ticket when blocked notification creation fails", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Blocked" } }));
    const toasts: unknown[] = [];

    const updated = await updateTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id, blockedReason: "need credentials" },
        overrides: {
          notify: {
            action: async () => {
              throw new Error("notification service unavailable");
            },
            toast: async (notice: unknown) => {
              toasts.push(notice);
            },
          } as never,
        },
      }),
    );

    expect(updated.blockedReason).toBe("need credentials");
    await expect(ticketsCollection(storage).get(ticket.id)).resolves.toMatchObject({
      blockedReason: "need credentials",
    });
    expect(toasts).toEqual([
      expect.objectContaining({
        type: "warning",
        title: "Ticket saved",
        message: "Notification sync failed: notification service unavailable",
      }),
    ]);
  });

  test("returns the saved ticket even when the warning toast itself fails", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Blocked" } }));

    const updated = await updateTicketCommand.run(
      ...makeCommandArgs({
        storage,
        params: { id: ticket.id, blockedReason: "need credentials" },
        overrides: {
          notify: {
            action: async () => {
              throw new Error("notification service unavailable");
            },
            toast: async () => {
              throw new Error("toast delivery unavailable");
            },
          } as never,
        },
      }),
    );

    expect(updated.blockedReason).toBe("need credentials");
    await expect(ticketsCollection(storage).get(ticket.id)).resolves.toMatchObject({
      blockedReason: "need credentials",
    });
  });

  test("throws when the status name is unknown", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "X" } }));

    await expect(
      updateTicketCommand.run(...makeCommandArgs({ storage, params: { id: ticket.id, status: "ghost" } })),
    ).rejects.toThrow(/Unknown status/);
  });
});

describe("updateTicket dependencies", () => {
  const seedDependents = async (storage: ReturnType<typeof createMemoryStorage>) => {
    const first = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "First" } }));
    const second = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "Second" } }));
    const ticket = await createTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "Dependent", dependsOn: [first.shorthand, second.shorthand] } }),
    );
    return { first, second, ticket };
  };

  test("replaces the whole dependency set", async () => {
    const storage = createMemoryStorage();
    const { first, ticket } = await seedDependents(storage);

    const updated = await updateTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: ticket.shorthand, dependsOn: [first.shorthand] } }),
    );

    expect(updated.dependsOn).toEqual([first.id]);
  });

  test("clears the dependency set on request", async () => {
    const storage = createMemoryStorage();
    const { first, second, ticket } = await seedDependents(storage);
    expect(ticket.dependsOn).toEqual([first.id, second.id]);

    const updated = await updateTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: ticket.shorthand, clearDependsOn: true } }),
    );

    expect(updated.dependsOn).toEqual([]);
  });

  test("keeps dependencies when the update does not mention them", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const { first, second, ticket } = await seedDependents(storage);

    const updated = await updateTicketCommand.run(
      ...makeCommandArgs({ storage, params: { id: ticket.shorthand, status: "In Progress" } }),
    );

    expect(updated.dependsOn).toEqual([first.id, second.id]);
  });

  test("names an unknown dependency shorthand and keeps the stored set", async () => {
    const storage = createMemoryStorage();
    const { first, second, ticket } = await seedDependents(storage);

    await expect(
      updateTicketCommand.run(...makeCommandArgs({ storage, params: { id: ticket.shorthand, dependsOn: ["T-404"] } })),
    ).rejects.toThrow(/Unknown ticket "T-404"/);

    await expect(ticketsCollection(storage).get(ticket.id)).resolves.toMatchObject({
      dependsOn: [first.id, second.id],
    });
  });
});
