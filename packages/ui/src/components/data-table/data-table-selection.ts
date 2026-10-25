import type { RowSelectionState } from "@tanstack/react-table";
import type { RowData } from "./types";

/** Retain values only for explicit selections; never fetch or retain unseen pages. */
export const retainSelectedRows = (
  previous: Map<string, RowData>,
  selected: RowSelectionState,
  visible: Map<string, RowData>,
) => {
  const rows = new Map<string, RowData>();
  for (const [id, chosen] of Object.entries(selected)) {
    const row = visible.get(id) ?? previous.get(id);
    if (chosen && row) rows.set(id, row);
  }
  return rows;
};
