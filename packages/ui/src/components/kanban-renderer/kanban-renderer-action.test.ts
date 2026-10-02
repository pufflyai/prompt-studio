import { expect, test } from "bun:test";
import { runKanbanAction } from "./kanban-renderer-action";
import { applyBoardMoveItem } from "./kanban-renderer-board-move";

test("a failed drag stops later mutations and reports once", async () => {
  const updates: string[] = [];
  const reports: unknown[] = [];
  await runKanbanAction(
    "Move row",
    () =>
      applyBoardMoveItem({
        settings: {
          columnGrouping: "status",
          rowGrouping: "type",
          ordering: { attributeId: "manual", direction: "asc" },
        },
        rowId: "ticket",
        targetColumnId: "done",
        targetGroupKey: "bug",
        onAttributeChange: async (_row, attribute) => {
          updates.push(attribute);
          throw new Error("Cannot update status");
        },
        onReorder: () => {
          updates.push("reorder");
        },
      }),
    (error, action) => reports.push({ error, action }),
  );
  expect(updates).toEqual(["status"]);
  expect(reports).toEqual([{ error: new Error("Cannot update status"), action: "Move row" }]);
});
