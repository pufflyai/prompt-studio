import { expect, test } from "bun:test";
import { createScribbleDocument, filterScribbleDocuments, moveScribbleDocument } from "./scribble-pages-state";
import { exampleDefaults } from "./state-defaults";

test("Scribble search matches titles and current document content across words", () => {
  const state = {
    ...exampleDefaults.scribble,
    contentById: { ...exampleDefaults.scribble.contentById, "field-notes": "A fresh observation about birds" },
  };
  expect(filterScribbleDocuments(state, " FIELD birds ").map((doc) => doc.id)).toEqual(["field-notes"]);
  expect(filterScribbleDocuments(state, "never matched")).toEqual([]);
  expect(filterScribbleDocuments(state, " ")).toEqual([...state.documents]);
});
test("moving a Scribble page preserves every other page and its content", () => {
  const state = exampleDefaults.scribble;
  const moved = moveScribbleDocument(state.documents, "oslo-weekend", "north-star", "before");
  expect(moved.map((doc) => doc.id)).toEqual(["oslo-weekend", "north-star", "field-notes", "reading-list"]);
  expect(state.documents.map((doc) => doc.id)).toEqual(["north-star", "field-notes", "oslo-weekend", "reading-list"]);
  expect(moveScribbleDocument(moved, "oslo-weekend", "field-notes", "after")).toEqual([...state.documents]);
});
test("new Scribble pages keep existing documents and start with empty editable content", () => {
  const state = exampleDefaults.scribble;
  const next = createScribbleDocument(state, "new-document");
  expect(next.documents.slice(0, -1)).toEqual([...state.documents]);
  expect(next.documents.at(-1)?.id).toBe("new-document");
  expect(next.contentById["new-document"]).toBe("");
  expect(next.contentById["north-star"]).toBe(state.contentById["north-star"]);
});
