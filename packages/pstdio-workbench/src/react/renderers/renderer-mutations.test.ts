import { expect, test } from "bun:test";
import { applyKanbanMove } from "@pstdio/ui/kanban-renderer";
import { createRendererMutationBinding, createRendererMutations } from "./renderer-mutations";

test("stale reads cannot undo an optimistic mutation, even after acknowledgement", () => {
  const state = createRendererMutations<number[]>();
  state.accept([1, 2], state.revision());
  const oldRead = state.revision();
  const move = state.begin((rows) => [...rows].reverse());
  expect(state.value()).toEqual([2, 1]);
  expect(state.accept([1, 2], oldRead)).toBe(false);
  state.finish(move, true);
  expect(state.accept([1, 2], oldRead)).toBe(false);
  expect(state.value()).toEqual([2, 1]);
  expect(state.accept([2, 1], state.revision())).toBe(true);
});

test("failed saves remove only their own preview and preserve later actions", () => {
  const state = createRendererMutations<Record<string, string>>();
  state.accept({ a: "todo", b: "todo" }, state.revision());
  const first = state.begin((rows) => ({ ...rows, a: "done" }));
  const next = state.begin((rows) => ({ ...rows, b: "done" }));
  state.finish(first, false);
  expect(state.value()).toEqual({ a: "todo", b: "done" });
  expect(state.accept({ a: "todo", b: "todo" }, state.revision())).toBe(false);
  state.finish(next, true);
  expect(state.value()).toEqual({ a: "todo", b: "done" });
});

test("later moves on the same row survive an earlier failure", () => {
  const state = createRendererMutations<string>();
  state.accept("todo", state.revision());
  const first = state.begin(() => "ready");
  const next = state.begin(() => "done");
  state.finish(first, false);
  state.finish(next, true);
  expect(state.value()).toBe("done");
});

test("a later drop in the same optimistic column retains its destination after the first save fails", () => {
  const state = createRendererMutations<Array<{ id: string; title: string; attributes: { status: string } }>>();
  state.accept(
    [
      { id: "a", title: "A", attributes: { status: "todo" } },
      { id: "b", title: "B", attributes: { status: "ready" } },
    ],
    state.revision(),
  );
  const first = state.begin((rows) => applyKanbanMove(rows, { rowId: "a", attributes: { status: "ready" } }));
  const next = state.begin((rows) =>
    applyKanbanMove(rows, { rowId: "a", attributes: { status: "ready" }, order: { beforeRowId: "b" } }),
  );
  state.finish(first, false);
  state.finish(next, true);
  expect(state.value()![0]).toMatchObject({ id: "a", attributes: { status: "ready" } });
});

test("reconnecting the same read binding retains pending preview and later gestures", () => {
  const binding = createRendererMutationBinding<string>();
  const first = binding.bind("panel", "board");
  first.accept("todo", first.revision());
  const move = first.begin(() => "ready");
  const reconnected = binding.bind("panel", "board");
  expect(reconnected).toBe(first);
  expect(reconnected.value()).toBe("ready");
  expect(reconnected.accept("todo", reconnected.revision())).toBe(false);
  const next = reconnected.begin(() => "done");
  first.finish(move, false);
  reconnected.finish(next, true);
  expect(reconnected.value()).toBe("done");
  expect(binding.bind("panel", "another-board").value()).toBeUndefined();
});
