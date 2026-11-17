import { expect, test } from "bun:test";
import type { CollectionSavedView, CollectionViewState, CollectionViewsSource } from "./collection-view-types";
import { saveCollectionView } from "./use-collection-views";

type Settings = { rowNumbers: boolean };

const view = (id: string, title: string, builtIn: boolean): CollectionSavedView<Settings> & { builtIn: boolean } => ({
  id,
  title,
  settings: { rowNumbers: true },
  filter: { conjunction: "and", rules: [] },
  sorts: [],
  builtIn,
});

const edited: CollectionViewState<Settings> = {
  settings: { rowNumbers: false },
  filter: { conjunction: "and", rules: [{ attributeId: "status", condition: "is", value: "done" }] },
  sorts: [{ attributeId: "started", direction: "desc" }],
};

const save = async (target: ReturnType<typeof view>) => {
  const updated: unknown[] = [];
  const created: unknown[] = [];
  const source: CollectionViewsSource<Settings> = {
    views: [target],
    defaultViewId: target.id,
    onCreateView: async (input) => ({ ...input, id: "created" }),
    onUpdateView: async (id, input) => {
      updated.push({ id, ...input });
    },
    onDeleteView: async () => undefined,
    onSetDefaultView: async () => undefined,
  };
  await saveCollectionView(source, target, edited, async (input) => {
    created.push(input);
  });
  return { updated, created };
};

test("saving edits to a built-in view creates the user's own copy and leaves the built-in view unchanged", async () => {
  const { updated, created } = await save(view("all", "All runs", true));
  expect(updated).toEqual([]);
  expect(created).toEqual([{ title: "All runs copy", ...edited }]);
});

test("saving edits to the user's own view updates that view", async () => {
  const { updated, created } = await save(view("mine", "Mine", false));
  expect(updated).toEqual([{ id: "mine", ...edited }]);
  expect(created).toEqual([]);
});
