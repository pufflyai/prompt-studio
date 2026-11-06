import { expect, test } from "bun:test";
import type { TreeNode, TreeViewSection } from "../../../core";
import { appendTreeMoveBatch, type TreeMoveBatch, treeMoveBatchPreview } from "./tree-move-batch";

const source = { id: "zzz-folder", label: "zzz-folder", canDrag: true, collapsible: true };
const target = { id: "generated", label: "generated", canDrop: true, collapsible: true };
const moved = { ...source, id: "generated/zzz-folder" };
const body: TreeViewSection[] = [{ id: "files", nodes: [source, target] }];
const snapshot = { body, childrenByNodeId: {} };
const revision = Symbol("before move");
const batch = (): TreeMoveBatch => ({
  scope: "files",
  snapshot,
  moves: [{ token: Symbol(), intent: { sourceId: source.id, targetId: target.id, position: "inside" } }],
});

test("an empty or foreign batch immediately uses the current tree", () => {
  const current = { scope: "other", body: [], childrenByNodeId: {}, revision };
  expect(treeMoveBatchPreview(batch(), current)).toMatchObject({ active: false, body: current.body });
  const empty = { ...batch(), moves: [] };
  expect(treeMoveBatchPreview(empty, { ...current, scope: "files" }).active).toBe(false);
});

test("a new move after confirmation captures the replacement snapshot before passive cleanup", () => {
  const pending = batch();
  pending.moves[0]!.saved = { after: revision };
  const current = {
    scope: "files",
    revision: Symbol("confirmed"),
    body: [{ id: "files", nodes: [moved, target] }],
    childrenByNodeId: {},
  };
  const move = { token: Symbol(), intent: { sourceId: moved.id, targetId: target.id, position: "inside" as const } };
  const next = appendTreeMoveBatch(pending, current, move);
  expect(next.moves).toEqual([move]);
  expect(next.snapshot.body).toBe(current.body);
  expect(ids(treeMoveBatchPreview(next, current).body[0]!.nodes)).toEqual(["generated", "generated/zzz-folder"]);
});
const ids = (nodes: TreeNode[]): string[] => nodes.flatMap((node) => [node.id, ...ids(node.children ?? [])]);

test("a pending move keeps its snapshot when a lazy read already returns the new path", () => {
  const preview = treeMoveBatchPreview(batch(), {
    ...snapshot,
    scope: "files",
    revision,
    childrenByNodeId: { generated: [moved] },
  });
  expect(ids(preview.body[0]!.nodes)).toEqual(["generated", "zzz-folder"]);
});

test("a replacement read retires confirmed moves before rendering its authoritative children", () => {
  const pending = batch();
  pending.moves[0]!.saved = { after: revision };
  const preview = treeMoveBatchPreview(pending, {
    scope: "files",
    revision: Symbol("after move"),
    body: [{ id: "files", nodes: [target] }],
    childrenByNodeId: { generated: [moved], [moved.id]: [{ id: `${moved.id}/keep.txt`, label: "keep.txt" }] },
  });
  expect(preview.active).toBe(false);
  expect(preview.body[0]!.nodes).toEqual([target]);
  expect(preview.childrenByNodeId.generated).toEqual([moved]);
  expect(preview.childrenByNodeId[moved.id]?.[0]?.id).toBe("generated/zzz-folder/keep.txt");
});

test("queued moves keep their common base and a failed save removes only its own intent", () => {
  const other = { id: "other", label: "Other", canDrag: true };
  const pending = batch();
  pending.snapshot = { body: [{ id: "files", nodes: [source, other, target] }], childrenByNodeId: {} };
  pending.moves[0]!.saved = { after: revision };
  pending.moves.push({ token: Symbol(), intent: { sourceId: other.id, targetId: target.id, position: "inside" } });
  const current = {
    scope: "files",
    revision: Symbol("first saved"),
    body: [{ id: "files", nodes: [other, target] }],
    childrenByNodeId: { generated: [moved] },
  };
  expect(ids(treeMoveBatchPreview(pending, current).body[0]!.nodes)).toEqual(["generated", "zzz-folder", "other"]);
  // The failed second write rolls back, while the first is already present in the authoritative snapshot.
  pending.moves.pop();
  const restored = treeMoveBatchPreview(pending, current);
  expect(restored.active).toBe(false);
  expect(restored.body).toBe(current.body);
  expect(restored.childrenByNodeId.generated).toEqual([moved]);
});
