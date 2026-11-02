import { strict as assert } from "node:assert";
import { createRow, type Workload } from "storage-scale-fixture";
import * as Y from "yjs";
import { memoryDocumentState } from "../shared";
import { createDocumentStorage } from "./document-storage";

const replica = (update: Uint8Array) => {
  const document = new Y.Doc();
  Y.applyUpdate(document, update);
  const state = memoryDocumentState(document);
  const storage = createDocumentStorage({
    owner: { workbenchId: "scale", extensionId: "scale.owner" },
    store: { transaction: async (_owner, action) => action(state) },
  });
  return { document, storage };
};

const checkMerged = async (
  target: ReturnType<typeof replica>,
  scenario: string,
  kind: Workload,
  rightValue: unknown,
) => {
  const first = createRow(kind, 0, 37, 3);
  const value = await target.storage.records.read(first.id);
  if (scenario === "delete-versus-edit") {
    assert(value.deleted);
    await target.storage.records.commit({
      operationId: "explicit-restore",
      edits: [{ recordId: first.id, deleted: false, replace: first }],
    });
    assert.deepEqual((await target.storage.records.read(first.id)).value, first);
    return value;
  }
  assert(!value.deleted);
  if (scenario === "same-record")
    assert.deepEqual(value.value, { ...first, title: "Offline left", enabled: !first.enabled });
  if (scenario === "different-record")
    assert.deepEqual((await target.storage.records.read(createRow(kind, 0, 38, 3).id)).value, rightValue);
  if (scenario === "same-field")
    assert(["Offline left", "Offline right"].includes((value.value as { title: string }).title));
  return value;
};

// Replays only concurrent increments into a base that retains every original causal identity.
export const verifyScaleOfflineMerges = async (base: Uint8Array, kind: Workload) => {
  const first = createRow(kind, 0, 37, 3);
  const second = createRow(kind, 0, 38, 3);
  const cases = ["same-record", "different-record", "same-field", "delete-versus-edit"];
  const results = [];
  for (const scenario of cases) {
    const left = replica(base);
    const right = replica(base);
    try {
      const vector = Y.encodeStateVector(left.document);
      await left.storage.records.commit({
        operationId: `left-${scenario}`,
        edits: [
          scenario === "delete-versus-edit"
            ? { recordId: first.id, deleted: true }
            : { recordId: first.id, replace: { ...first, title: "Offline left" } },
        ],
      });
      const rightRow = scenario === "different-record" ? second : first;
      const rightValue =
        scenario === "same-field"
          ? { ...rightRow, title: "Offline right" }
          : { ...rightRow, enabled: !rightRow.enabled };
      await right.storage.records.commit({
        operationId: `right-${scenario}`,
        edits: [{ recordId: rightRow.id, replace: rightValue }],
      });
      const updates = [Y.encodeStateAsUpdate(left.document, vector), Y.encodeStateAsUpdate(right.document, vector)];
      const merged = [];
      for (const order of [
        [0, 1],
        [1, 0],
      ]) {
        const target = replica(base);
        try {
          for (const index of order) await target.storage.applyUpdate(updates[index]);
          const value = await checkMerged(target, scenario, kind, rightValue);
          merged.push(value);
        } finally {
          target.document.destroy();
        }
      }
      assert.deepEqual(merged[0], merged[1]);
      results.push({
        scenario,
        deliveryOrders: [
          [0, 1],
          [1, 0],
        ],
        correct: true,
        incrementalBytes: updates.map((update) => update.byteLength),
      });
    } finally {
      left.document.destroy();
      right.document.destroy();
    }
  }
  return results;
};
