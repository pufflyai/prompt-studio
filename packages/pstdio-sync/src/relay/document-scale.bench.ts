import { strict as assert } from "node:assert";
import {
  assertBenchmarkWorker,
  assertMeasurementWindow,
  createRow,
  measure,
  runBenchmarkEntrypoint,
  seedOwner,
  type Workload,
} from "storage-scale-fixture";
import * as Y from "yjs";
import { verifyScaleOfflineMerges } from "../document-scale-offline";
import { createDocumentStorage } from "../document-storage";
import { memoryDocumentState } from "../document-types";
import { cloneDocument, missingUpdate } from "./document-merge";

// An explicit diagnostic, never discovered by bun test. Run in a disposable worker per owner.
export const benchmarkSyncOwner = async (kind: Workload, count: number, churn: boolean) => {
  assertBenchmarkWorker();
  const lease = assertMeasurementWindow();
  console.log(JSON.stringify({ phase: "timing-window", lease }));
  const owner = { workbenchId: "scale", extensionId: "scale.owner" };
  const document = new Y.Doc();
  const state = memoryDocumentState(document);
  const storage = createDocumentStorage({ owner, store: { transaction: async (_owner, run) => run(state) } });
  const emit = (phase: string, data: unknown) =>
    console.log(JSON.stringify({ kind, count, churn, phase, ...(data as object) }));
  try {
    const seed = await measure(async () => {
      await seedOwner(
        {
          commit: ({ operationId, rows, deleted }) =>
            storage.records.commit({
              operationId,
              edits: [
                ...rows.map((row) => ({ recordId: row.id, replace: row })),
                ...deleted.map((recordId) => ({ recordId, deleted: true })),
              ],
            }),
        },
        kind,
        0,
        count,
        false,
        () => {},
      );
      if (churn)
        await seedOwner(
          {
            commit: ({ operationId, rows, deleted }) =>
              storage.records.commit({
                operationId,
                edits: [
                  ...rows.map((row) => ({ recordId: row.id, replace: row })),
                  ...deleted.map((recordId) => ({ recordId, deleted: true })),
                ],
              }),
          },
          kind,
          0,
          count,
          true,
          () => {},
        );
    });
    assert.equal(document.getMap("records").size, count);
    emit("fixture", {
      ...seed,
      live: count,
      sharedTypes: document.share.size,
      tombstones: document.getMap("deleted").size,
    });
    const encoded = await measure(async () => Y.encodeStateAsUpdate(document));
    emit("encode-owner", { ...encoded, value: undefined, encodedBytes: encoded.value.byteLength });
    const offline = await measure(() => verifyScaleOfflineMerges(encoded.value, kind));
    emit("offline-merge-correctness", offline);
    for (let sample = 0; sample < 10; sample++) {
      const hydration = await measure(async () => {
        const cold = new Y.Doc();
        Y.applyUpdate(cold, encoded.value);
        return cold;
      });
      emit("hydrate-owner", {
        ...hydration,
        value: undefined,
        sample,
        decodedBytes: encoded.value.byteLength,
        fullOwnerLoads: 1,
      });
      hydration.value.destroy();
      const clone = await measure(async () => cloneDocument(document));
      emit("clone-owner", {
        ...clone,
        value: undefined,
        sample,
        cloneCount: 1,
        encodedBytes: sample === 0 ? encoded.value.byteLength : null,
      });
      const remote = clone.value;
      try {
        const noop = await measure(async () => missingUpdate(document, remote));
        assert.equal(noop.value, null);
        emit("noop-sync", { ...noop, sample, cloneCount: 1, fullOwnerLoads: 1 });
        const edit = await measure(() =>
          storage.records.commit({
            operationId: `measured-${sample}`,
            edits: [
              {
                recordId: createRow(kind, 0, 37, 3).id,
                replace: { ...createRow(kind, 0, 37, 3), title: `Measured ${sample}` },
              },
            ],
          }),
        );
        emit("apply-single-edit", { ...edit, sample, recordsTouched: 1, sharedTypes: document.share.size });
        const incoming = await measure(async () => missingUpdate(document, remote));
        assert(incoming.value);
        emit("incoming-diff", {
          ...incoming,
          value: undefined,
          sample,
          encodedBytes: incoming.value.byteLength,
          cloneCount: 1,
        });
        const apply = await measure(async () => Y.applyUpdate(remote, incoming.value!));
        emit("apply-incoming", { ...apply, sample, decodedBytes: incoming.value.byteLength });
        assert.equal(missingUpdate(document, remote), null);
      } finally {
        remote.destroy();
      }
      const read = await measure(() => storage.records.list());
      assert.equal(read.value.length, count);
      emit("list-owner", {
        ...read,
        value: undefined,
        sample,
        scanned: count,
        materialized: count,
        payloadBytes: Buffer.byteLength(JSON.stringify(read.value)),
        fullOwnerLoads: 0,
      });
    }
  } finally {
    document.destroy();
  }
  assertMeasurementWindow();
};

if (import.meta.main) {
  const [kind, count, variant] = process.argv.slice(2);
  if (
    (kind !== "rich" && kind !== "small") ||
    ![1_000, 10_000, 100_000].includes(Number(count)) ||
    (kind === "rich" && Number(count) === 100_000)
  )
    throw new Error("Use rich 1000|10000 or small 1000|10000|100000 [churn]");
  await runBenchmarkEntrypoint("sync-owner", () => benchmarkSyncOwner(kind, Number(count), variant === "churn"));
}
