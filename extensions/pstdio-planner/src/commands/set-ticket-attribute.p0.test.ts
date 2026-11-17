import { describe, expect, test } from "bun:test";
import { createMemoryStorage } from "@pstdio/sdk/testing";
import { createTagOption, createTicketTag, readTicketTags } from "../data/tag-operations";
import { ticketContext, ticketsCollection } from "../data/ticket-context.fixture";
import { makeCommandArgs } from "./command-context.fixture";
import { createTicketCommand } from "./create-ticket";
import { setTicketAttributeCommand } from "./set-ticket-attribute";

describe("setTicketAttributeCommand", () => {
  test("moves a ticket to the target status column", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "X" } }));

    const moved = await setTicketAttributeCommand.run(
      ...makeCommandArgs({ storage, params: { rowId: created.id, attributeId: "status", value: "s-done" } }),
    );

    expect(moved?.statusId).toBe("s-done");
    expect((await ticketsCollection(storage).get(created.id))?.statusId).toBe("s-done");
  });

  test("clears the status when dropped on the No Status column", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "X", statusId: "s-todo" } }),
    );

    const moved = await setTicketAttributeCommand.run(
      ...makeCommandArgs({ storage, params: { rowId: created.id, attributeId: "status", value: "" } }),
    );

    expect(moved?.statusId).toBeNull();
  });

  test("ignores unknown attributes and missing tickets", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "X" } }));

    const unchanged = await setTicketAttributeCommand.run(
      ...makeCommandArgs({ storage, params: { rowId: created.id, attributeId: "mystery", value: "v" } }),
    );
    const missing = await setTicketAttributeCommand.run(
      ...makeCommandArgs({ storage, params: { rowId: "nope", attributeId: "status", value: "s" } }),
    );

    expect(unchanged?.id).toBe(created.id);
    expect(missing).toBeNull();
  });

  test("updates a default tag using its display attribute id", async () => {
    const storage = createMemoryStorage();
    const created = await createTicketCommand.run(...makeCommandArgs({ storage, params: { title: "X" } }));
    const { tags } = await readTicketTags(storage);
    const priority = tags.find((tag) => tag.id === "default-priority")!;
    const high = priority.options.find((option) => option.id === "default-priority-high")!;

    const updated = await setTicketAttributeCommand.run(
      ...makeCommandArgs({ storage, params: { rowId: created.id, attributeId: "priority", value: high.id } }),
    );

    expect(updated?.tagIds).toEqual([high.id]);
    expect((await ticketsCollection(storage).get(created.id))?.tags).toEqual({ "default-priority": high.id });
  });

  test("updates a multi-select tag without replacing unrelated tag values", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags.find((tag) => tag.id === "default-priority")!;
    const high = priority.options.find((option) => option.id === "default-priority-high")!;
    const surface = await createTicketTag({ ...ticketContext(storage), name: "Surface", type: "multi_select" });
    const api = await createTagOption({ ...ticketContext(storage), tagId: surface.id, name: "api" });
    const dashboard = await createTagOption({ ...ticketContext(storage), tagId: surface.id, name: "dashboard" });
    const created = await createTicketCommand.run(
      ...makeCommandArgs({ storage, params: { title: "X", tagIds: [high.id, api.id] } }),
    );

    const updated = await setTicketAttributeCommand.run(
      ...makeCommandArgs({
        storage,
        params: { rowId: created.id, attributeId: surface.id, value: [api.id, dashboard.id] },
      }),
    );

    expect(updated?.tagIds).toEqual([high.id, api.id, dashboard.id]);
    expect((await ticketsCollection(storage).get(created.id))?.tags).toEqual({
      "default-priority": high.id,
      [surface.id]: [api.id, dashboard.id],
    });
  });
});

test("concurrent property changes preserve each other's fields", async () => {
  const storage = createMemoryStorage();
  const created = await createTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Concurrent", statusId: "ready" } }),
  );
  const { tags } = await readTicketTags(storage);
  const high = tags
    .find((tag) => tag.id === "default-priority")!
    .options.find((option) => option.id === "default-priority-high")!;
  await Promise.all([
    setTicketAttributeCommand.run(
      ...makeCommandArgs({ storage, params: { rowId: created.id, attributeId: "priority", value: high.id } }),
    ),
    setTicketAttributeCommand.run(
      ...makeCommandArgs({ storage, params: { rowId: created.id, attributeId: "status", value: "done" } }),
    ),
  ]);
  const saved = await ticketsCollection(storage).get(created.id);
  expect(saved?.statusId).toBe("done");
  expect(saved?.tags).toEqual({ "default-priority": high.id });
});

test("property edits skip tickets whose core identity has not arrived", async () => {
  const storage = createMemoryStorage();
  const created = await createTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Waiting for identity", statusId: "ready" } }),
  );
  const resources = { ...ticketContext(storage).resources, identity: async () => null };
  expect(
    await setTicketAttributeCommand.run(
      ...makeCommandArgs({
        storage,
        params: { rowId: created.id, attributeId: "status", value: "done" },
        overrides: { resources },
      }),
    ),
  ).toBeNull();
  expect((await storage.collection<{ statusId: string }>("tickets").get(created.id))?.statusId).toBe("ready");
});

test("property edits retain the title derived from current native content", async () => {
  const storage = createMemoryStorage();
  const created = await createTicketCommand.run(
    ...makeCommandArgs({ storage, params: { title: "Old title", statusId: "ready" } }),
  );
  const records = storage.collection<Record<string, unknown>>("tickets");
  await records.put(created.id, {
    ...(await records.get(created.id))!,
    title: "Old title",
    content: "# Current native title\n\nBody",
  });
  const saved = await setTicketAttributeCommand.run(
    ...makeCommandArgs({ storage, params: { rowId: created.id, attributeId: "status", value: "done" } }),
  );
  expect(saved?.title).toBe("Current native title");
  expect((await records.get(created.id))?.title).toBe("Current native title");
});
