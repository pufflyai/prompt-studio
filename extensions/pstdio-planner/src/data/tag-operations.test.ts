import { describe, expect, test } from "bun:test";
import { putTicket } from "./collections";
import { createMemoryStorage } from "./memory-storage";
import {
  createTagOption,
  deleteTagOption,
  deleteTicketTag,
  readTicketTags,
  setTicketTags,
  updateTagOption,
} from "./tag-operations";
import type { StoredTicket } from "./types";

const ticket = (overrides: Partial<StoredTicket>): StoredTicket => ({
  id: crypto.randomUUID(),
  shorthand: "T-1",
  title: "T",
  content: "",
  statusId: null,
  archived: false,
  sortOrder: 0,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("tag operations", () => {
  test("seeds default tags and exposes sorted options", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);

    expect(tags.map((tag) => tag.name)).toEqual(["Priority", "Type"]);
    expect(tags[0]?.type).toBe("single_select");
    expect(tags[1]?.type).toBe("multi_select");
  });

  test("setTicketTags replaces the ticket's tag option ids", async () => {
    const storage = createMemoryStorage();
    const created = await putTicket(storage, ticket({ tagIds: ["old"] }));

    const updated = await setTicketTags({ storage, ticketId: created.id, tagIds: ["a", "b"] });

    expect(updated?.tagIds).toEqual(["a", "b"]);
  });

  test("create and update a tag option with icon and description", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags[0]!;

    const created = await createTagOption({
      storage,
      tagId: priority.id,
      name: "Blocker",
      color: "red",
      icon: "flame",
      description: "Hard blocker",
    });
    expect(created).toMatchObject({ icon: "flame", description: "Hard blocker" });

    await updateTagOption({ storage, tagId: priority.id, optionId: created.id, icon: "bug", description: "A bug" });

    const { tags: after } = await readTicketTags(storage);
    const stored = after[0]!.options.find((option) => option.id === created.id);
    expect(stored).toMatchObject({ icon: "bug", description: "A bug", name: "Blocker", color: "red" });
  });

  test("updateTagOption persists a new sort order for reordering", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags[0]!;
    const created = await createTagOption({ storage, tagId: priority.id, name: "Blocker", color: "red" });

    await updateTagOption({ storage, tagId: priority.id, optionId: created.id, sortOrder: 99 });

    const { tags: after } = await readTicketTags(storage);
    expect(after[0]!.options.find((option) => option.id === created.id)?.sortOrder).toBe(99);
  });

  test("deleting a tag option strips it from tickets", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags[0]!;
    const option = await createTagOption({ storage, tagId: priority.id, name: "Blocker", color: "red" });
    const created = await putTicket(storage, ticket({ tagIds: [option.id] }));

    await deleteTagOption({ storage, tagId: priority.id, optionId: option.id });

    const { ticketsCollection } = await import("./collections");
    expect((await ticketsCollection(storage).get(created.id))?.tagIds).toEqual([]);
  });

  test("deleting a tag strips all its option ids from tickets", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags[0]!;
    const optionId = priority.options[0]!.id;
    const created = await putTicket(storage, ticket({ tagIds: [optionId] }));

    await deleteTicketTag({ storage, tagId: priority.id });

    const { ticketsCollection } = await import("./collections");
    expect((await ticketsCollection(storage).get(created.id))?.tagIds).toEqual([]);
  });
});
