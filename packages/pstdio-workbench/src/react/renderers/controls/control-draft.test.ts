import { expect, test } from "bun:test";
import { mergeControlDraft } from "./control-draft";

test("refresh keeps unapplied values while updating other controls", () => {
  expect(mergeControlDraft({ status: "todo", name: "draft" }, { status: "done", name: "saved" }, { name: 1 })).toEqual({
    status: "done",
    name: "draft",
  });
});

test("refresh keeps immediate selections while saving", () => {
  expect(mergeControlDraft({ status: "todo" }, { status: "done" }, { status: 1 })).toEqual({
    status: "todo",
  });
});

test("acknowledged controls use saved values on refresh", () => {
  expect(mergeControlDraft({ status: "todo" }, { status: "done" }, {})).toEqual({ status: "done" });
});
