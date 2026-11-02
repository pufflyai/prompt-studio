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
