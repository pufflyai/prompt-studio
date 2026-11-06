import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { TreeNode, TreeViewSection } from "../../../core";
import { appendTreeMoveBatch, type TreeMoveBatch, treeMoveBatchPreview } from "./tree-move-batch";
import { previewTreeMove, type TreeMoveIntent } from "./tree-move-preview";

// Keep a queued batch on one snapshot until a completed read confirms its writes.
// Reads are told apart by `revision`, not by `body`: a read that returns equal data keeps the same body.
export const useTreeMovement = (input: {
  scope: string;
  body: TreeViewSection[];
  revision?: symbol;
  childrenByNodeId: Record<string, TreeNode[]>;
  persist?: (sourceId: string, targetId?: string, position?: TreeMoveIntent["position"]) => Promise<boolean>;
  canMove(sourceId: string, targetId?: string): boolean;
  refresh(): void;
}) => {
  const { scope, body, revision, childrenByNodeId, persist, canMove, refresh } = input;
  const [pending, setPending] = useState<TreeMoveBatch>({ scope, snapshot: { body, childrenByNodeId }, moves: [] });
  const latestRevision = useRef(revision);
  useLayoutEffect(() => {
    latestRevision.current = revision;
  }, [revision]);
  const queue = useRef(Promise.resolve());
  const current = { scope, body, childrenByNodeId, revision };
  const preview = treeMoveBatchPreview(pending, current);
  useEffect(() => {
    if (!pending.moves.length || preview.active) return;
    setPending((current) => {
      if (!current.moves.length) return current;
      if (treeMoveBatchPreview(current, { scope, body, childrenByNodeId, revision }).active) return current;
      return { scope, snapshot: { body, childrenByNodeId }, moves: [] };
    });
  }, [scope, body, childrenByNodeId, revision, pending, preview.active]);
  return {
    body: preview.body,
    childrenByNodeId: preview.childrenByNodeId,
    moveNode: persist
      ? (sourceId: string, targetId?: string, position: TreeMoveIntent["position"] = "inside") => {
          if (!canMove(sourceId, targetId)) return;
          if (
            !targetId ||
            previewTreeMove(preview.body, preview.childrenByNodeId, { sourceId, targetId, position }) === preview.body
          ) {
            queue.current = queue.current.then(async () => {
              await persist(sourceId, targetId, position);
              refresh();
            });
            return;
          }
          const intent = { sourceId, targetId, position };
          const token = Symbol("tree move");
          setPending((pending) => appendTreeMoveBatch(pending, current, { token, intent }));
          // Serial writes preserve the user's order when several drops happen before the first save finishes.
          queue.current = queue.current.then(async () => {
            const saved = await persist(sourceId, targetId, position);
            setPending((current) =>
              current.scope !== scope
                ? current
                : {
                    ...current,
                    moves: saved
                      ? current.moves.map((move) =>
                          move.token === token ? { ...move, saved: { after: latestRevision.current } } : move,
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
