import type { TreeNode, TreeViewSection } from "../../../core";
import { previewTreeMove, type TreeMoveIntent } from "./tree-move-preview";

export interface PendingTreeMove {
  token: symbol;
  intent: TreeMoveIntent;
  saved?: { after: symbol | undefined };
}
export interface TreeMoveSnapshot {
  body: TreeViewSection[];
  childrenByNodeId: Record<string, TreeNode[]>;
}
export interface TreeMoveBatch {
  scope: string;
  snapshot: TreeMoveSnapshot;
  moves: PendingTreeMove[];
}
type CurrentTreeMoveSnapshot = TreeMoveSnapshot & { scope: string; revision?: symbol };
const isActive = (pending: TreeMoveBatch, current: CurrentTreeMoveSnapshot) =>
  pending.scope === current.scope && pending.moves.some((move) => !move.saved || move.saved.after === current.revision);

export const appendTreeMoveBatch = (
  pending: TreeMoveBatch,
  current: CurrentTreeMoveSnapshot,
  move: PendingTreeMove,
) => {
  const active = isActive(pending, current);
  return {
    scope: current.scope,
    snapshot: active ? pending.snapshot : { body: current.body, childrenByNodeId: current.childrenByNodeId },
    moves: [...(active ? pending.moves : []), move],
  };
};
export const treeMoveBatchPreview = (pending: TreeMoveBatch, current: CurrentTreeMoveSnapshot) => {
  // Keep a pending batch on one provider snapshot. Lazy reads may already contain the persisted
  // destination with new IDs, while this snapshot still contains its old source.
  const active = isActive(pending, current);
  const moves = active ? pending.moves : [];
  const snapshot = active ? pending.snapshot : current;
  return {
    active,
    body: moves.reduce(
      (sections, move) => previewTreeMove(sections, snapshot.childrenByNodeId, move.intent),
      snapshot.body,
    ),
    childrenByNodeId: active ? {} : current.childrenByNodeId,
  };
};
