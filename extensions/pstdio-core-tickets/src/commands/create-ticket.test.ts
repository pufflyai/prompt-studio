import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses } from "../data/seed";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { deleteTicketCommand } from "./delete-ticket";

describe("createTicketCommand", () => {
  test("creates a ticket with the default status and an incrementing shorthand", async () => {
    const storage = createMemoryStorage();
    const statuses = await seedDefaultStatuses(storage);
    const defaultStatus = statuses.find((status) => status.isDefault)!;

    const first = await createTicketCommand.run(
      makeCommandContext({ storage, params: { title: "First", content: "hello" } }),
    );
    const second = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Second" } }));

    expect(first.shorthand).toBe("T-1");
    expect(first.title).toBe("First");
    expect(first.content).toBe("hello");
    expect(first.statusId).toBe(defaultStatus.id);
    expect(first.archived).toBe(false);
    expect(first.id).toBeTruthy();

    expect(second.shorthand).toBe("T-2");

    const stored = await ticketsCollection(storage).list();
    expect(stored).toHaveLength(2);
    expect(stored.every((ticket) => Boolean(ticket.id))).toBe(true);
  });

  test("honors an explicit status", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);

    const ticket = await createTicketCommand.run(
      makeCommandContext({ storage, params: { title: "Pinned", statusId: "custom" } }),
    );

    expect(ticket.statusId).toBe("custom");
  });

  test("stores attachment refs on the ticket row", async () => {
    const storage = createMemoryStorage();
    const attachment = {
      id: "file-1",
      name: "diagram.png",
      mimeType: "image/png",
      size: 512,
      hash: "sha256",
      url: "/v1/projects/proj-1/extensions/files/file-1/content",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };

    const created = await createTicketCommand.run(
      makeCommandContext({ storage, params: { title: "With attachment", attachments: [attachment] } }),
    );

    expect(created.attachments).toEqual([attachment]);
  });

  test("continues shorthand and sort order after hard delete", async () => {
    const storage = createMemoryStorage();
    await createTicketCommand.run(makeCommandContext({ storage, params: { title: "First" } }));
    const second = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Second" } }));
    await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Third" } }));

    await deleteTicketCommand.run(makeCommandContext({ storage, params: { rowId: second.id } }));
    const created = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Fourth" } }));

    expect(created.shorthand).toBe("T-4");
    expect(created.sortOrder).toBe(3);
  });
});
