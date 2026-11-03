import { expect, test } from "bun:test";
import { createFileRendererPendingDraft } from "./file-renderer-pending-draft";

test("resource removal observes the editor's live pending state", () => {
  const draft = createFileRendererPendingDraft();
  let pending = false;
  const dispose = draft.register(
    "note",
    () => pending,
    () => {},
  );
  expect(draft.retainRemoved("note")).toBe(false);
  pending = true;
  expect(draft.retainRemoved("note")).toBe(true);
  dispose();
  expect(draft.retainRemoved("note")).toBe(false);
});

test("a previous file's pending draft cannot retain a different binding", () => {
  const draft = createFileRendererPendingDraft();
  draft.register(
    "previous",
    () => true,
    () => {},
  );
  expect(draft.retainRemoved("current")).toBe(false);
});

test("an old session's cleanup cannot release its successor's draft", () => {
  const draft = createFileRendererPendingDraft();
  const previous = draft.register(
    "note",
    () => false,
    () => {},
  );
  const current = draft.register(
    "note",
    () => true,
    () => {},
  );
  previous();
  expect(draft.retainRemoved("note")).toBe(true);
  current();
  expect(draft.retainRemoved("note")).toBe(false);
});

test("only the matching pending editor receives removal and can discard on explicit close", () => {
  const draft = createFileRendererPendingDraft();
  let removed = 0;
  let pending = false;
  draft.register(
    "note",
    () => pending,
    () => removed++,
  );
  expect(draft.retainRemoved("note")).toBe(false);
  pending = true;
  expect(draft.retainRemoved("other")).toBe(false);
  expect(removed).toBe(0);
  expect(draft.retainRemoved("note")).toBe(true);
  expect(removed).toBe(1);
});
