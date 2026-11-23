import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import type { TreeNode, TreeViewSection, WorkbenchCore } from "../../../core";
import { classifyApiWrite } from "../../../core/registries/mutations/operation-failures";
import type { OperationRead } from "../../../core/registries/mutations/operation-types";
import {
  getWorkbenchOperations,
  operationSubject,
  resourceOperationSubject,
} from "../../../core/registries/mutations/operations";
import { reportUserActionError } from "../../../core/shared/run-user-action";
import { getWorkbenchQueries } from "../../../core/workbench-queries";
import { findNodeInSections } from "./tree-list-adapter";
import { appendTreeMoveBatch, type TreeMoveBatch, treeMoveBatchPreview } from "./tree-move-batch";
import { previewTreeMove, type TreeMoveIntent } from "./tree-move-preview";

const domain = "tree.move";
interface SharedTreeMove {
  scope: string;
  move: TreeMoveIntent;
}

type MovementInput = {
  workbench: WorkbenchCore;
  projectId?: string;
  scope: string;
  body: TreeViewSection[];
  revision?: symbol;
  childrenByNodeId: Record<string, TreeNode[]>;
  persist?: (sourceId: string, targetId?: string, position?: TreeMoveIntent["position"]) => Promise<boolean>;
  canMove(sourceId: string, targetId?: string): boolean;
  read: Pick<OperationRead, "key" | "refresh">;
  onError?: (error: unknown) => void;
};

const treeMoveSubject = (input: MovementInput, node?: TreeNode | null) =>
  node?.resource
    ? resourceOperationSubject({ ...node.resource, projectId: node.resource.projectId ?? input.projectId })
    : operationSubject("tree-node", input.projectId, input.scope, node?.id);

export const useTreeMovement = (input: MovementInput) => {
  const { workbench, projectId, scope, body, revision, childrenByNodeId, persist, canMove, read, onError } = input;
  const operations = getWorkbenchOperations(getWorkbenchQueries(workbench));
  const { pending: shared } = useSyncExternalStore(
    operations.subscribe,
    operations.getSnapshot,
    operations.getSnapshot,
  );
  const [batch, setBatch] = useState<TreeMoveBatch>({ scope, snapshot: { body, childrenByNodeId }, moves: [] });
  const latestRevision = useRef(revision);
  useLayoutEffect(() => {
    latestRevision.current = revision;
  }, [revision]);
  const current = { scope, body, childrenByNodeId, revision };
  // Keep the originating snapshot until its first canonical read, including lazy children whose IDs can change.
  const local = treeMoveBatchPreview({ ...batch, moves: batch.moves.filter(({ saved }) => saved) }, current);
  const pending = shared.flatMap((entry) => {
    if (entry.domain !== domain || entry.projectId !== projectId || entry.status === "unknown" || !entry.intent)
      return [];
    const operation = entry.intent as SharedTreeMove;
    return operation.scope === scope ? [operation.move] : [];
  });
  const projected = pending.reduce(
    (sections, move) => previewTreeMove(sections, local.childrenByNodeId, move),
    local.body,
  );
  useEffect(() => {
    if (!batch.moves.length || local.active || pending.length) return;
    setBatch({ scope, snapshot: { body, childrenByNodeId }, moves: [] });
  }, [scope, body, childrenByNodeId, batch.moves.length, local.active, pending.length]);

  const moveNode = (sourceId: string, targetId?: string, position: TreeMoveIntent["position"] = "inside") => {
    if (!persist || !canMove(sourceId, targetId)) return;
    const source = findNodeInSections(body, sourceId, childrenByNodeId);
    const target = targetId ? findNodeInSections(body, targetId, childrenByNodeId) : undefined;
    const subjects = [treeMoveSubject(input, source), treeMoveSubject(input, target)];
    const blocked = operations
      .getSnapshot()
      .pending.some(
        (entry) =>
          (entry.status === "unknown" || entry.status === "unconfirmed") &&
          entry.subjects.some((subject) => subjects.includes(subject)),
      );
    const report = onError ?? ((error: unknown) => reportUserActionError(workbench, "Move", error));
    if (blocked) return report(new Error("This tree has an unfinished move. Check System activity."));
    const move = targetId ? { sourceId, targetId, position } : undefined;
    try {
      const attempt = operations.submit({
        domain,
        projectId,
        subjects,
        title: source?.label ? `Move ${source.label}` : "Move item",
        source: source?.resource,
        draft: { sourceId, targetId, position },
        intent: move ? ({ scope, move } satisfies SharedTreeMove) : undefined,
        classify: classifyApiWrite,
        async write(signal) {
          signal.throwIfAborted();
          if (!(await persist(sourceId, targetId, position))) throw new Error("The tree move was rejected.");
        },
        originatingRead: read,
      });
      if (move) setBatch((previous) => appendTreeMoveBatch(previous, current, { token: attempt.id, intent: move }));
      void attempt.result.then(
        () =>
          setBatch((previous) => ({
            ...previous,
            moves: previous.moves.map((item) =>
              item.token === attempt.id ? { ...item, saved: { after: latestRevision.current } } : item,
            ),
          })),
        (error: unknown) => {
          setBatch((previous) => ({ ...previous, moves: previous.moves.filter(({ token }) => token !== attempt.id) }));
          report(error);
        },
      );
    } catch (error) {
      report(error);
    }
  };
  return {
    body: projected,
    childrenByNodeId: projected === local.body ? local.childrenByNodeId : {},
    moveNode: persist ? moveNode : undefined,
  };
};
