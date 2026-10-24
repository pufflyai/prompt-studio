import { expect, test } from "bun:test";
import { adoptionEdit, mergeJson } from "./record-adoption";

test("changes either device made since the shared value survive a three-way merge", () => {
  const base = { title: "Plan", tags: ["a"], owner: "ann", draft: true };
  const local = { title: "Plan", tags: ["a", "b"], owner: "ann" };
  const remote = { title: "Release plan", tags: ["a"], owner: "ann", draft: true, due: "Friday" };
  expect(mergeJson(base, local, remote)).toEqual({
    title: "Release plan",
    tags: ["a", "b"],
    owner: "ann",
    due: "Friday",
  });
});

test("the local value wins where both devices changed it, and without a shared value", () => {
  expect(mergeJson({ title: "A" }, { title: "Local" }, { title: "Remote" })).toEqual({ title: "Local" });
  expect(mergeJson(undefined, { title: "Local", only: 1 }, { title: "Remote", other: 2 })).toEqual({
    title: "Local",
    only: 1,
    other: 2,
  });
});

const record = (value: unknown, extra: object = {}) => ({
  recordId: "note",
  exists: true,
  revision: "r",
  value: value as never,
  asset: null,
  deleted: false,
  shared: null,
  ...extra,
});

test("adopting a record edits only what this device changed", () => {
  expect(adoptionEdit(record("a"), record("a"), record("b"))).toBeNull();
  expect(adoptionEdit(record("a"), record("c"), record("b"))).toEqual({ recordId: "note", replace: "c" });
  expect(adoptionEdit(record("a"), record("a", { deleted: true }), record("a"))).toEqual({
    recordId: "note",
    deleted: true,
  });
  expect(
    adoptionEdit(
      record(null, { shared: { kind: "text", value: "hello" } }),
      record(null, { shared: { kind: "text", value: "hello world" } }),
      record(null, { shared: { kind: "text", value: "hello" } }),
    ),
  ).toEqual({ recordId: "note", shared: [{ kind: "text.insert", index: 5, text: " world" }] });
});
