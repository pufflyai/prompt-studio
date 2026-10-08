import { useEffect, useRef, useState } from "react";
import type { TreeNode, TreeViewSection } from "../../../core";
import { previewTreeMove, type TreeMoveIntent } from "./tree-move-preview";

interface PendingMove {
  token: symbol;
  intent: TreeMoveIntent;
  savedAfter?: TreeViewSection[];
}

// Keep only unconfirmed intent. The renderer owns persistence and every completed read replaces the preview.
export const useTreeMovement = (input: {
  scope: string;
  body: TreeViewSection[];
  childrenByNodeId: Record<string, TreeNode[]>;
  persist?: (sourceId: string, targetId?: string, position?: TreeMoveIntent["position"]) => Promise<boolean>;
  canMove(sourceId: string, targetId?: string): boolean;
  refresh(): void;
}) => {
  const { scope, body, childrenByNodeId, persist, canMove, refresh } = input;
  const [pending, setPending] = useState<{ scope: string; moves: PendingMove[] }>({ scope, moves: [] });
  const latestBody = useRef(body);
  latestBody.current = body;
  const queue = useRef(Promise.resolve());
  useEffect(() => {
    setPending((current) => {
      if (current.scope !== scope) return { scope, moves: [] };
      const moves = current.moves.filter((move) => !move.savedAfter || move.savedAfter === body);
      return moves.length === current.moves.length ? current : { scope, moves };
    });
  }, [scope, body]);
  const moves = pending.scope === scope ? pending.moves : [];
  const preview = moves.reduce((sections, move) => previewTreeMove(sections, childrenByNodeId, move.intent), body);
  return {
    body: preview,
    // Preview parents contain their loaded children, so the adapter must not append the old children again.
    childrenByNodeId: moves.length ? {} : childrenByNodeId,
    moveNode: persist
      ? (sourceId: string, targetId?: string, position: TreeMoveIntent["position"] = "inside") => {
          if (!canMove(sourceId, targetId)) return;
          if (!targetId || previewTreeMove(preview, childrenByNodeId, { sourceId, targetId, position }) === preview) {
            queue.current = queue.current.then(async () => {
              await persist(sourceId, targetId, position);
              refresh();
            });
            return;
          }
          const intent = { sourceId, targetId, position };
          const token = Symbol("tree move");
          setPending((current) => ({
            scope,
            moves: [...(current.scope === scope ? current.moves : []), { token, intent }],
          }));
          // Serial writes preserve the user's order when several drops happen before the first save finishes.
          queue.current = queue.current.then(async () => {
            const saved = await persist(sourceId, targetId, position);
            setPending((current) =>
              current.scope !== scope
                ? current
                : {
                    scope,
                    moves: saved
                      ? current.moves.map((move) =>
                          move.token === token ? { ...move, savedAfter: latestBody.current } : move,
                        )
                      : current.moves.filter((move) => move.token !== token),
                  },
            );
            // Retry cancels an older read so it cannot replace the preview with a pre-save snapshot.
            refresh();
          });
        }
      : undefined,
  };
};
