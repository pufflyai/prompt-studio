import type { MarmaladeAction, MarmaladeState } from "./marmalade.types";
import { applyMarmaladeAction } from "./marmalade-document";

type DocumentSnapshot = Pick<MarmaladeState, "document" | "selectedIds" | "expandedIds">;
export interface MarmaladeHistory {
  past: DocumentSnapshot[];
  future: DocumentSnapshot[];
}
const snapshot = (state: MarmaladeState) => ({
  document: state.document,
  selectedIds: state.selectedIds,
  expandedIds: state.expandedIds,
});

export const applyMarmaladeHistory = (current: MarmaladeState, history: MarmaladeHistory, action: MarmaladeAction) => {
  if (action.type === "undo" || action.type === "redo") {
    const undo = action.type === "undo";
    const source = undo ? history.past : history.future;
    const target = source.at(-1);
    if (!target) return { state: current, history };
    const saved = snapshot(current);
    return {
      state: { ...current, ...structuredClone(target) },
      history: {
        past: undo ? source.slice(0, -1) : [...history.past, saved],
        future: undo ? [...history.future, saved] : source.slice(0, -1),
      },
    };
  }
  const state = applyMarmaladeAction(current, action);
  if (JSON.stringify(state.document) === JSON.stringify(current.document)) return { state, history };
  return { state, history: { past: [...history.past, snapshot(current)].slice(-20), future: [] } };
};
