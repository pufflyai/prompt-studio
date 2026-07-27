import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { seedDefaultStatuses, seedDefaultTags } from "../data/seed";
import { makeCommandContext } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { deleteTicketCommand } from "./delete-ticket";

describe("createTicketCommand", () => {
  test("creates a ticket with the default status and an incrementing shorthand", async () => {
    const storage = createMemoryStorage();
    const statuses = await seedDefaultStatuses(storage);
    const defaultStatus = statuses.find((status) => status.isDefault)!;

    const first = await createTicketCommand.run(
      makeCommandContext({ storage, params: { content: "# Heading\n\nhello" } }),
    );
    const second = await createTicketCommand.run(makeCommandContext({ storage, params: { content: "Second" } }));

    expect(first.shorthand).toBe("T-1");
    expect(first.title).toBe("Heading");
    expect(first.content).toBe("# Heading\n\nhello");
    expect(first.statusId).toBe(defaultStatus.id);
    expect(first.archived).toBe(false);
    expect(first.id).toBeTruthy();

    expect(second.shorthand).toBe("T-2");

    const stored = await ticketsCollection(storage).list();
    expect(stored).toHaveLength(2);
    expect(stored.every((ticket) => Boolean(ticket.id))).toBe(true);
  });

  test("uses the project shorthand when allocating ticket shorthand", async () => {
    const storage = createMemoryStorage();

    const first = await createTicketCommand.run(
      makeCommandContext({
        storage,
        params: { title: "First" },
        overrides: { project: { id: "proj-1", name: "Prompt Studio", shorthand: "PS" } },
      }),
    );
    const second = await createTicketCommand.run(
      makeCommandContext({
        storage,
        params: { title: "Second" },
        overrides: { project: { id: "proj-1", name: "Prompt Studio", shorthand: "PS" } },
      }),
    );

    expect(first.shorthand).toBe("PS-1");
    expect(second.shorthand).toBe("PS-2");
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

  test("resolves status, tags, and parent by name/shorthand", async () => {
    const storage = createMemoryStorage();
    await seedDefaultStatuses(storage);
    await seedDefaultTags(storage);
    const parent = await createTicketCommand.run(makeCommandContext({ storage, params: { title: "Parent" } }));

    const created = await createTicketCommand.run(
      makeCommandContext({
        storage,
        params: { title: "Child", status: "TODO", tags: ["High", "Bug"], parent: parent.shorthand },
      }),
    );

    expect(created.statusId).toBe("ready");
    expect(created.tagIds).toEqual(["default-priority-high", "default-type-bug"]);
    expect(created.parentId).toBe(parent.id);
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

  test("continues project shorthand after hard delete", async () => {
    const storage = createMemoryStorage();
    const ctx = (title: string) =>
      makeCommandContext({
        storage,
        params: { title },
        overrides: { project: { id: "proj-1", name: "Prompt Studio", shorthand: "PS" } },
      });

    await createTicketCommand.run(ctx("First"));
    const second = await createTicketCommand.run(ctx("Second"));
    await createTicketCommand.run(ctx("Third"));

    await deleteTicketCommand.run(makeCommandContext({ storage, params: { rowId: second.id } }));
    const created = await createTicketCommand.run(ctx("Fourth"));

    expect(created.shorthand).toBe("PS-4");
  });

  test("continues numbering after legacy ticket shorthands", async () => {
    const storage = createMemoryStorage();
    await ticketsCollection(storage).put("legacy", {
      id: "legacy",
      shorthand: "T-3",
      title: "Legacy",
      content: "",
      statusId: null,
      archived: false,
      sortOrder: 0,
      createdAt: "",
      updatedAt: "",
    });

    const created = await createTicketCommand.run(
      makeCommandContext({
        storage,
        params: { title: "Next" },
        overrides: { project: { id: "proj-1", name: "Prompt Studio", shorthand: "PS" } },
      }),
    );

    expect(created.shorthand).toBe("PS-4");
  });
});
