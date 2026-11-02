import { expect, test } from "bun:test";
import { shareEqualValue } from "./share-equal-value";

const rows = [
  { id: "a", title: "First", attributes: { status: "todo", tags: ["x"] } },
  { id: "b", title: "Second", attributes: { status: "done", tags: [] } },
];

test("a reload that returns equal data keeps the value already on screen", () => {
  const previous = { rows };
  expect(shareEqualValue(previous, structuredClone(previous))).toBe(previous);
});

test("a reload that changes one row keeps every unchanged row", () => {
  const previous = { rows };
  const next = structuredClone(previous);
  next.rows[1]!.title = "Renamed";
  const shared = shareEqualValue(previous, next);
  expect(shared).toEqual(next);
  expect(shared).not.toBe(previous);
  expect(shared.rows[0]).toBe(rows[0]);
  expect(shared.rows[1]).not.toBe(rows[1]);
});

test("a changed part stays the loaded object, so lookups keyed by that object still find it", () => {
  const sources = new WeakMap<object, string>();
  const previous = { rows };
  const next = structuredClone(previous);
  next.rows[1]!.title = "Renamed";
  sources.set(next, "load");
  sources.set(next.rows[1]!, "renamed row");
  const shared = shareEqualValue(previous, next);
  expect(shared).toBe(next);
  expect(sources.get(shared)).toBe("load");
  expect(sources.get(shared.rows[1]!)).toBe("renamed row");
  expect(shared.rows[0]).toBe(rows[0]);
});

test("a changed parent keeps its unchanged children", () => {
  const child = { id: "child", label: "Child" };
  const previous = { id: "parent", label: "Parent", children: [child] };
  const next = { id: "parent", label: "Renamed", children: [{ id: "child", label: "Child" }] };
  const shared = shareEqualValue(previous, next);
  expect(shared).toBe(next);
  expect(shared.children[0]).toBe(child);
});

test("frozen data is returned as loaded", () => {
  const next = Object.freeze({ rows: Object.freeze([{ id: "a", title: "Changed" }, rows[1]]) });
  const shared = shareEqualValue({ rows }, next);
  expect(shared).toBe(next);
});

test("added and removed rows and fields are not hidden by sharing", () => {
  expect(shareEqualValue({ rows }, { rows: rows.slice(0, 1) })).toEqual({ rows: rows.slice(0, 1) });
  expect(shareEqualValue({ rows, page: 1 }, { rows })).toEqual({ rows });
  expect(shareEqualValue({ rows }, { rows, page: undefined })).toEqual({ rows, page: undefined });
});

test("values that are not plain data keep the new instance", () => {
  const previous = { at: new Date(0), render: () => null };
  const next = { at: new Date(0), render: () => null };
  const shared = shareEqualValue(previous, next);
  expect(shared.at).toBe(next.at);
  expect(shared.render).toBe(next.render);
});

test("moving a row keeps every row object, matched by id", () => {
  const previous = { rows };
  const moved = { rows: [structuredClone(rows[1]!), structuredClone(rows[0]!)] };
  const shared = shareEqualValue(previous, moved);
  expect(shared).toEqual(moved);
  expect(shared.rows[0]).toBe(rows[1]);
  expect(shared.rows[1]).toBe(rows[0]);
});
