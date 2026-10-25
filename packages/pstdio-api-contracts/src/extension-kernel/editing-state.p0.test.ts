import { expect, test } from "bun:test";
import { applyEditingChanges, diffEditingState } from "./editing-state";
import type { JsonObject } from "./types/json";

test("editing patches retain compound fields, arrays and removed properties", () => {
  const before: JsonObject = { title: "Original", position: { x: 0, y: 0 }, layers: ["one"], removed: true };
  const after = { title: "Updated", position: { x: 12, y: 24 }, layers: ["one", "two"] };
  expect(applyEditingChanges(before, diffEditingState(before, after))).toEqual(after);
  expect(before.position).toEqual({ x: 0, y: 0 });
  expect(diffEditingState(after, structuredClone(after))).toEqual([]);
});

test("editing patches reject prototype access and non-object roots atomically", () => {
  const state = { title: "Original" };
  expect(() => applyEditingChanges(state, [{ path: ["__proto__", "title"], value: "Changed" }])).toThrow();
  expect(() => applyEditingChanges(state, [{ path: [], value: 1 }])).toThrow();
  expect(() => applyEditingChanges({ layers: ["one"] }, [{ path: ["layers", "0"], value: "two" }])).toThrow();
  expect(state).toEqual({ title: "Original" });
});
