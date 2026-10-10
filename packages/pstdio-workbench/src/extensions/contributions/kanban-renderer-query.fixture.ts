import type { KanbanRendererQueryState } from "../../core";

export const queryState: KanbanRendererQueryState = {
  settings: {
    viewMode: "board",
    columnGrouping: "status",
    rowGrouping: "none",
    displayProperties: [],
  },
  filter: { conjunction: "and", rules: [] },
  sorts: [],
};
