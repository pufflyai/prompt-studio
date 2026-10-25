import { expect, test } from "bun:test";
import { createMemoryStorage, createMemoryStorageDevices, makeCommandContext } from "@pstdio/sdk/testing";
import { readExampleState } from "./example-state";
import { createScribblePage, saveScribblePageCommand, updateScribblePageCommand } from "./scribble-commands";
import { emptyScribbleDraft } from "./scribble-draft";
import { scribbleTree } from "./scribble-tree";

test("opening a new Scribble page does not create a saved note", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const before = await readExampleState(storage, "scribble");
  await createScribblePage.run(ctx, {});
  expect((await readExampleState(storage, "scribble")).documents).toEqual(before.documents);
});

const saveDraft = (ctx: ReturnType<typeof makeCommandContext>, id: string) =>
  saveScribblePageCommand.run(ctx, {
    id,
    changes: [{ path: [], value: { ...emptyScribbleDraft, title: "A saved page", content: "Saved draft content" } }],
  });

test("simultaneous Scribble saves retain both pages", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  const before = await readExampleState(storage, "scribble");
  const results = await Promise.all([createScribblePage.run(ctx, {}), createScribblePage.run(ctx, {})]);
  await Promise.all(results.map((result) => saveDraft(ctx, result.id)));
  const after = await readExampleState(storage, "scribble");
  expect(after.documents).toHaveLength(before.documents.length + 2);
  expect(after.documents.map((document) => document.id)).toEqual(
    expect.arrayContaining(results.map((result) => result.id)),
  );
});

test("Scribble saving and reordering on separate devices preserve every page", async () => {
  const { devices, merge } = await createMemoryStorageDevices();
  const [first, second] = devices.map((storage) => makeCommandContext({ storage, params: {} }));
  const [created] = await Promise.all([
    saveDraft(first, "saved-draft"),
    scribbleTree.body.onMove(second, {
      renderer: { rendererId: "scribble-pages" },
      source: { id: "oslo-weekend", label: "Oslo weekend" },
      target: { id: "north-star", label: "North star" },
      position: "before",
    }),
  ]);
  await merge();
  for (const storage of devices) {
    const state = await readExampleState(storage, "scribble");
    expect(state.documents.map((document) => document.id)).toEqual([
      "oslo-weekend",
      "north-star",
      "field-notes",
      "reading-list",
      created.id,
    ]);
  }
});

test("renaming, choosing an icon and reordering the same page merge across devices", async () => {
  const { devices, merge } = await createMemoryStorageDevices();
  const [first, second] = devices.map((storage) => makeCommandContext({ storage, params: {} }));
  await Promise.all([
    updateScribblePageCommand.run(first, { id: "oslo-weekend", title: "A quiet weekend", icon: "book-open" }),
    scribbleTree.body.onMove(second, {
      renderer: { rendererId: "scribble-pages" },
      source: { id: "oslo-weekend", label: "Oslo weekend" },
      target: { id: "north-star", label: "North star" },
      position: "before",
    }),
  ]);
  await merge();
  for (const storage of devices)
    expect((await readExampleState(storage, "scribble")).documents[0]).toMatchObject({
      id: "oslo-weekend",
      title: "A quiet weekend",
      icon: "book-open",
    });
});

test("saving the same draft twice creates one note and keeps its content", async () => {
  const storage = createMemoryStorage();
  const ctx = makeCommandContext({ storage, params: {} });
  await saveDraft(ctx, "draft");
  await saveDraft(ctx, "draft");
  const state = await readExampleState(storage, "scribble");
  expect(state.documents.filter((document) => document.id === "draft")).toHaveLength(1);
  expect(state.contentById.draft).toBe("Saved draft content");
});
