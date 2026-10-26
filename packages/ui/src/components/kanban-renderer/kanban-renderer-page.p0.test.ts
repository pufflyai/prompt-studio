import { expect, test } from "bun:test";
import { applyKanbanPageCounts } from "./kanban-renderer-page";
import { DEFAULT_KANBAN_RENDERER_SETTINGS } from "./types";

test("an ungrouped board reports the complete matching count", () => {
  const groups = [{ key: "all", label: "All", rows: [{ id: "one", title: "One", attributes: {} }], subgroups: [] }];
  const result = applyKanbanPageCounts(
    groups,
    [],
    [],
    { ...DEFAULT_KANBAN_RENDERER_SETTINGS, columnGrouping: "none", rowGrouping: "none" },
    250,
  );
  expect(result[0].count).toBe(250);
  expect(result[0].rows).toHaveLength(1);
});
