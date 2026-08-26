import { describe, expect, test } from "bun:test";
import { ticketsCollection } from "../data/collections";
import { createMemoryStorage } from "../data/memory-storage";
import { createTagOption, createTicketTag, readTicketTags } from "../data/tag-operations";
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
    expect((await ticketsCollection(storage).get(created.id))?.tagIds).toEqual([high.id]);
  });

  test("updates a multi-select tag without replacing unrelated tag values", async () => {
    const storage = createMemoryStorage();
    const { tags } = await readTicketTags(storage);
    const priority = tags.find((tag) => tag.id === "default-priority")!;
    const high = priority.options.find((option) => option.id === "default-priority-high")!;
    const surface = await createTicketTag({ storage, name: "Surface", type: "multi_select" });
    const api = await createTagOption({ storage, tagId: surface.id, name: "api" });
    const dashboard = await createTagOption({ storage, tagId: surface.id, name: "dashboard" });
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
    expect((await ticketsCollection(storage).get(created.id))?.tagIds).toEqual([high.id, api.id, dashboard.id]);
  });
});
