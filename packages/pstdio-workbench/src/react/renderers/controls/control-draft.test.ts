import { expect, test } from "bun:test";
import { mergeControlDraft } from "./control-draft";

test("refresh keeps unapplied values while updating other controls", () => {
  expect(
    mergeControlDraft({ status: "todo", name: "draft" }, { status: "done", name: "saved" }, { name: true }, true),
  ).toEqual({ status: "done", name: "draft" });
});

test("immediate controls use the saved values on refresh", () => {
  expect(mergeControlDraft({ status: "todo" }, { status: "done" }, { status: true }, false)).toEqual({
    status: "done",
  });
});
