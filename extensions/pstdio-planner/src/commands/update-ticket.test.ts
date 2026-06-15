import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { getTicketCommand } from "./get-ticket";
import { updateTicketCommand } from "./update-ticket";

describe("get/update ticket commands", () => {
  test("getTicket returns the stored ticket or null", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "X" } }));

    const found = await getTicketCommand.run(makeCommandContext({ storage, params: { id: created.id } }));
    const missing = await getTicketCommand.run(makeCommandContext({ storage, params: { id: "nope" } }));

    expect(found?.id).toBe(created.id);
    expect(missing).toBeNull();
  });

  test("updateTicket re-derives the title from the saved content", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(
      makeCommandContext({ storage, params: { content: "# Original\n\nold" } }),
    );
    expect(created.title).toBe("Original");

    const updated = await updateTicketCommand.run(
      makeCommandContext({ storage, params: { id: created.id, content: "# Renamed\n\nnew body" } }),
    );

    expect(updated?.content).toBe("# Renamed\n\nnew body");
    expect(updated?.title).toBe("Renamed");

    const persisted = await ticketsCollection(storage).get(created.id);
    expect(persisted?.content).toBe("# Renamed\n\nnew body");
  });

  test("updateTicket throws for an unknown ticket", async () => {
    const storage = createMemoryStorage();
    await expect(
      updateTicketCommand.run(makeCommandContext({ storage, params: { id: "missing", content: "x" } })),
    ).rejects.toThrow(/Unknown ticket "missing"/);
  });
});

describe("updateTicket server-side resolution", () => {
  test("resolves status name, tag names, and parent shorthand", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedDefaultTags(storage);
    const parent = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Parent" } }));
    const child = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Child" } }));

    const updated = await updateTicketCommand.run(
      makeCommandContext({
        storage,
        params: { id: child.shorthand, status: "In Progress", tags: ["High"], parent: parent.shorthand },
      }),
    );

    expect(updated?.statusId).toBe("default-in-progress");
    expect(updated?.tagIds).toEqual(["default-priority-high"]);
    expect(updated?.parentId).toBe(parent.id);
  });

  test("unlinks the parent and sets a blocked reason", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const parent = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Parent" } }));
    const child = await createTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Child", parentId: parent.id } }),
    );
    expect(child.parentId).toBe(parent.id);

    const updated = await updateTicketCommand.run(
      makeCommandContext({ storage, params: { id: child.id, unlinkParent: true, blockedReason: "waiting on infra" } }),
    );

    expect(updated?.parentId).toBeNull();
    expect(updated?.blockedReason).toBe("waiting on infra");
  });

  test("throws when the status name is unknown", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    const ticket = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "X" } }));

    await expect(
      updateTicketCommand.run(makeCommandContext({ storage, params: { id: ticket.id, status: "ghost" } })),
    ).rejects.toThrow(/Unknown status/);
  });
});
