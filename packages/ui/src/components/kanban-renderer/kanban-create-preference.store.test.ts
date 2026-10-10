import { expect, test } from "bun:test";
import { createKanbanCreatePreferenceStore } from "./kanban-create-preference.store";

const memoryStorage = () => {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
};

test("remembers whether to open created rows when the dialog is reopened or reloaded", () => {
  const storage = memoryStorage();
  const first = createKanbanCreatePreferenceStore(storage);
  expect(first.getState().openCreatedRow).toBe(true);
  first.getState().setOpenCreatedRow(false);
  const reopened = createKanbanCreatePreferenceStore(storage);
  expect(reopened.getState().openCreatedRow).toBe(false);
  reopened.getState().setOpenCreatedRow(true);
  expect(createKanbanCreatePreferenceStore(storage).getState().openCreatedRow).toBe(true);
});

test("keeps the create preference within its host storage", () => {
  const first = createKanbanCreatePreferenceStore(memoryStorage());
  first.getState().setOpenCreatedRow(false);
  expect(createKanbanCreatePreferenceStore(memoryStorage()).getState().openCreatedRow).toBe(true);
});
