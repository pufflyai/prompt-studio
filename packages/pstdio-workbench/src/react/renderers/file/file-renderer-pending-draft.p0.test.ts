import { expect, test } from "bun:test";
import { createFileRendererPendingDraft } from "./file-renderer-pending-draft";

test("resource removal observes the editor's live pending state", () => {
  const draft = createFileRendererPendingDraft();
  let pending = false;
  const dispose = draft.register("note", () => pending);
  expect(draft.hasPending("note")).toBe(false);
  pending = true;
  expect(draft.hasPending("note")).toBe(true);
  dispose();
  expect(draft.hasPending("note")).toBe(false);
});

test("a previous file's pending draft cannot retain a different binding", () => {
  const draft = createFileRendererPendingDraft();
  draft.register("previous", () => true);
  expect(draft.hasPending("current")).toBe(false);
});

test("an old session's cleanup cannot release its successor's draft", () => {
  const draft = createFileRendererPendingDraft();
  const previous = draft.register("note", () => false);
  const current = draft.register("note", () => true);
  previous();
  expect(draft.hasPending("note")).toBe(true);
  current();
  expect(draft.hasPending("note")).toBe(false);
});
