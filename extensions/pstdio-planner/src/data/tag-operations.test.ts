import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import {
  applyTagDraft,
  createTagOption,
  deleteTagOption,
  deleteTicketTag,
  readTicketTags,
  setTicketTags,
  updateTagOption,
  updateTicketTag,
} from "./tag-operations";
import { putTicket, ticketContext } from "./ticket-context.fixture";
import type { Ticket } from "./types";

const ticket = (overrides: Partial<Ticket>): Ticket => ({
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

    expect(tags.map((tag) => tag.name)).toEqual(["Priority", "Type", "Complexity"]);
    expect(tags.map((tag) => tag.type)).toEqual(["single_select", "single_select", "single_select"]);
  });

  test("setTicketTags stores the flat tag option ids by tag", async () => {
    const storage = createMemoryStorage();
    const created = await putTicket(storage, ticket({ tags: { "default-priority": "default-priority-low" } }));

    const updated = await setTicketTags({
      ...ticketContext(storage),
      ticketId: created.id,
      tagIds: ["default-type-bug", "default-priority-high", "unknown"],
    });

    expect(updated?.tags).toEqual({ "default-priority": "default-priority-high", "default-type": "default-type-bug" });
  });

  test("create and update a tag option with icon and description", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags[0]!;

    const created = await createTagOption({
      ...ticketContext(storage),
      tagId: priority.id,
      name: "Blocker",
      color: "red",
      icon: "flame",
      description: "Hard blocker",
    });
    expect(created).toMatchObject({ icon: "flame", description: "Hard blocker" });

    await updateTagOption({
      ...ticketContext(storage),
      tagId: priority.id,
      optionId: created.id,
      icon: "bug",
      description: "A bug",
    });

    const { tags: after } = await readTicketTags(storage);
    const stored = after[0]!.options.find((option) => option.id === created.id);
    expect(stored).toMatchObject({ icon: "bug", description: "A bug", name: "Blocker", color: "red" });
  });

  test("updateTicketTag persists a new sort order", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const flags = tags.at(-1)!;

    await updateTicketTag({ ...ticketContext(storage), tagId: flags.id, sortOrder: 1 });

    const { tags: after } = await readTicketTags(storage);
    expect(after.find((tag) => tag.id === flags.id)?.sortOrder).toBe(1);
  });

  test("updateTagOption persists a new sort order for reordering", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags[0]!;
    const created = await createTagOption({
      ...ticketContext(storage),
      tagId: priority.id,
      name: "Blocker",
      color: "red",
    });

    await updateTagOption({ ...ticketContext(storage), tagId: priority.id, optionId: created.id, sortOrder: 99 });

    const { tags: after } = await readTicketTags(storage);
    expect(after[0]!.options.find((option) => option.id === created.id)?.sortOrder).toBe(99);
  });

  test("deleting a tag option strips it from tickets", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags[0]!;
    const option = await createTagOption({
      ...ticketContext(storage),
      tagId: priority.id,
      name: "Blocker",
      color: "red",
    });
    const created = await putTicket(storage, ticket({ tags: { [priority.id]: option.id } }));

    await deleteTagOption({ ...ticketContext(storage), tagId: priority.id, optionId: option.id });

    const { ticketsCollection } = await import("./ticket-context.fixture");
    expect((await ticketsCollection(storage).get(created.id))?.tags).toEqual({});
  });

  test("applyTagDraft commits type, creates, updates, and deletes in one tag write", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags[0]!;
    const renameTarget = priority.options[0]!;
    const removeTarget = priority.options[1]!;
    const ticketRecord = await putTicket(storage, ticket({ tags: { [priority.id]: removeTarget.id } }));
    const kept = await putTicket(storage, ticket({ tags: { [priority.id]: renameTarget.id } }));

    await applyTagDraft({
      ...ticketContext(storage),
      tagId: priority.id,
      type: "multi_select",
      optionsToCreate: [{ name: "Critical", color: "red", icon: "flame" }],
      optionsToUpdate: [{ id: renameTarget.id, name: "Top", color: renameTarget.color, icon: renameTarget.icon }],
      optionIdsToDelete: [removeTarget.id],
    });

    const { tags: after } = await readTicketTags(storage);
    const updated = after[0]!;
    expect(updated.type).toBe("multi_select");
    expect(updated.options.find((option) => option.id === renameTarget.id)?.name).toBe("Top");
    expect(updated.options.find((option) => option.id === removeTarget.id)).toBeUndefined();
    expect(updated.options.find((option) => option.name === "Critical")).toMatchObject({ color: "red", icon: "flame" });

    const { ticketsCollection } = await import("./ticket-context.fixture");
    // Priority is now multi-select, so the emptied list stays and can merge later additions.
    expect((await ticketsCollection(storage).get(ticketRecord.id))?.tags).toEqual({ [priority.id]: [] });
    // The value moves to the multi-select shape with the tag.
    expect((await ticketsCollection(storage).get(kept.id))?.tags).toEqual({ [priority.id]: [renameTarget.id] });
  });

  test("applyTagDraft rejects without writing when the tag does not exist", async () => {
    const storage = createMemoryStorage();

    await expect(
      applyTagDraft({
        ...ticketContext(storage),
        tagId: "missing-tag",
        type: "multi_select",
        optionsToCreate: [{ name: "Critical", color: "red", icon: "flame" }],
        optionsToUpdate: [],
        optionIdsToDelete: [],
      }),
    ).rejects.toThrow("Unknown ticket tag: missing-tag");

    const { tags } = await readTicketTags(storage);
    expect(tags.some((tag) => tag.id === "missing-tag")).toBe(false);
  });

  test("deleting a tag removes its value from tickets", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags[0]!;
    const optionId = priority.options[0]!.id;
    const created = await putTicket(
      storage,
      ticket({ tags: { [priority.id]: optionId, "default-type": "default-type-bug" } }),
    );

    await deleteTicketTag({ ...ticketContext(storage), tagId: priority.id });

    const { ticketsCollection } = await import("./ticket-context.fixture");
    expect((await ticketsCollection(storage).get(created.id))?.tags).toEqual({ "default-type": "default-type-bug" });
  });
});
