import { expect, test } from "bun:test";
import { prepareKanbanMove } from "./kanban-move";

const operation = { rowId: "first", attributes: { status: "ready", priority: "high" }, order: {} };

test("individual callbacks save grouping attributes before manual order", async () => {
  const saved: unknown[] = [];
  const mutation = prepareKanbanMove(
    {
      onAttributeChange: async (...args) => {
        await Promise.resolve();
        saved.push(args);
      },
      onReorder: (...args) => {
        saved.push(args);
      },
    },
    operation,
  );
  expect(mutation.move).toEqual(operation);
  await mutation.save();
  expect(saved).toEqual([
    ["first", "status", "ready"],
    ["first", "priority", "high"],
    ["first", undefined],
  ]);
});

test("attribute-only moves do not preview unsupported manual ordering", () => {
  const mutation = prepareKanbanMove({ onAttributeChange: () => {} }, operation);
  expect(mutation.move.order).toBeUndefined();
  expect(mutation.move.attributes).toEqual(operation.attributes);
});

test("reorder-only moves do not preview unsupported grouping changes", () => {
  const mutation = prepareKanbanMove({ onReorder: () => {} }, operation);
  expect(mutation.move.attributes).toEqual({});
  expect(mutation.move.order).toEqual({});
});

test("a complete callback owns the full move", async () => {
  const saved: unknown[] = [];
  const mutation = prepareKanbanMove(
    {
      onMove: (move) => {
        saved.push(move);
      },
      onAttributeChange: () => {
        throw new Error("The complete callback owns the move");
      },
    },
    operation,
  );
  await mutation.save();
  expect(saved).toEqual([operation]);
});

test("a failed grouping change stops the remaining move", async () => {
  const saved: unknown[] = [];
  const mutation = prepareKanbanMove(
    {
      onAttributeChange: () => {
        throw new Error("Status save failed");
      },
      onReorder: () => {
        saved.push("order");
      },
    },
    operation,
  );
  await expect(mutation.save()).rejects.toThrow("Status save failed");
  expect(saved).toEqual([]);
});
