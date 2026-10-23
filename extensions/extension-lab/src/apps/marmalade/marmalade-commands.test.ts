import { expect, test } from "bun:test";
import { editMarmalade, readMarmalade } from "./marmalade-commands";

const context = (projectId: string) => {
  const values = new Map<string, unknown>();
  let events = 0;
  return {
    projectId,
    storage: {
      ids: { create: () => crypto.randomUUID() },
      records: {
        id: (id: string) => id,
        read: async (id: string) => ({
          exists: values.has(id),
          value: structuredClone(values.get(id)),
          deleted: false,
        }),
        commit: async (group: { operationId: string; edits: { recordId: string; replace: unknown }[] }) => {
          for (const edit of group.edits) values.set(edit.recordId, structuredClone(edit.replace));
          return { operationId: group.operationId, state: "saved-locally" };
        },
      },
    },
    events: {
      emit: async () => {
        events += 1;
      },
    },
    eventCount: () => events,
  };
};
test("public document commands persist edits from concurrent views and keep projects separate", async () => {
  const ctx = context("project-a");
  await Promise.all([
    editMarmalade.run(ctx as never, { action: { type: "text", id: "title", text: "Ocean study" } }),
    editMarmalade.run(ctx as never, { action: { type: "visibility", id: "artwork", visible: false } }),
  ]);
  const saved = await readMarmalade.run(ctx as never, {});
  expect(saved.document.layers.find((layer) => layer.id === "title")?.text).toBe("Ocean study");
  expect(saved.document.layers.find((layer) => layer.id === "artwork")?.visible).toBe(false);
  expect(ctx.eventCount()).toBe(2);
  const other = await readMarmalade.run(context("project-b") as never, {});
  expect(other.document.layers.find((layer) => layer.id === "artwork")?.visible).toBe(true);
});
test("a rejected edit leaves state intact and does not block the next command", async () => {
  const ctx = context("invalid-edit");
  await editMarmalade.run(ctx as never, { action: { type: "lock", id: "caption", locked: true } });
  await expect(
    editMarmalade.run(ctx as never, { action: { type: "text", id: "title", text: "Rejected" } }),
  ).rejects.toThrow("locked");
  await editMarmalade.run(ctx as never, { action: { type: "lock", id: "caption", locked: false } });
  expect(ctx.eventCount()).toBe(2);
  expect((await readMarmalade.run(ctx as never, {})).document.layers.find((layer) => layer.id === "title")?.text).toBe(
    "The Great Wave",
  );
});

test("undo and redo share document history across views without recording selection or viewport changes", async () => {
  const ctx = context("history");
  await editMarmalade.run(ctx as never, { action: { type: "text", id: "title", text: "Ocean" } });
  await editMarmalade.run(ctx as never, { action: { type: "select", ids: ["artwork"] } });
  await editMarmalade.run(ctx as never, { action: { type: "viewport", zoom: 0.5 } });
  expect((await readMarmalade.run(ctx as never, {})).history).toEqual({ undo: 1, redo: 0 });
  const undone = await editMarmalade.run(ctx as never, { action: { type: "undo" } });
  expect(undone.document.layers.find((layer) => layer.id === "title")?.text).toBe("The Great Wave");
  expect(undone.zoom).toBe(0.5);
  expect(undone.history).toEqual({ undo: 0, redo: 1 });
  const redone = await editMarmalade.run(ctx as never, { action: { type: "redo" } });
  expect(redone.document.layers.find((layer) => layer.id === "title")?.text).toBe("Ocean");
  await editMarmalade.run(ctx as never, { action: { type: "undo" } });
  const changed = await editMarmalade.run(ctx as never, { action: { type: "opacity", id: "card", opacity: 0.4 } });
  expect(changed.history).toEqual({ undo: 1, redo: 0 });
});

test("rejected edits and unchanged values do not consume history and undo restores deleted groups", async () => {
  const ctx = context("history-delete");
  await editMarmalade.run(ctx as never, { action: { type: "opacity", id: "card", opacity: 0.9 } });
  expect((await readMarmalade.run(ctx as never, {})).history.undo).toBe(0);
  await editMarmalade.run(ctx as never, { action: { type: "select", ids: ["caption"] } });
  await editMarmalade.run(ctx as never, { action: { type: "delete" } });
  const undone = await editMarmalade.run(ctx as never, { action: { type: "undo" } });
  expect(undone.document.layers).toHaveLength(6);
  expect(undone.selectedIds).toEqual(["caption"]);
  expect(undone.expandedIds).toContain("caption");
  await expect(
    editMarmalade.run(ctx as never, { action: { type: "adjustments", id: "artwork", changes: { blur: -1 } } }),
  ).rejects.toThrow();
  expect((await readMarmalade.run(ctx as never, {})).history).toEqual({ undo: 0, redo: 1 });
});
