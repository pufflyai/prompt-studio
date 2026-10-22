import { recordMeasurement, recordPeakMemory } from "pstdio-benchmarks/writer";
import { createDocumentStorageDBService } from "./document-storage";
import { createExtensionStorageFixture } from "./extension-storage.fixture";

const f = await createExtensionStorageFixture();
try {
  const owner = { workbenchId: f.projectAId, extensionId: "ext.example" };
  const { records } = createDocumentStorageDBService(f.db).open({ owner });
  const samples: { priorEdits: number; meanMilliseconds: number; largestUpdateBytes: number }[] = [];
  let count = 0;
  for (const priorEdits of [100, 20_000]) {
    while (count < priorEdits) {
      await records.commit({
        operationId: `history-${count}`,
        edits: [{ recordId: "ticket", replace: { title: `Title ${count}`, status: "ready" } }],
      });
      count++;
    }
    const start = performance.now();
    for (let sample = 0; sample < 100; sample++)
      await records.commit({
        operationId: `sample-${priorEdits}-${sample}`,
        edits: [{ recordId: "ticket", replace: { title: `Sample ${sample}`, status: "ready" } }],
      });
    const elapsed = performance.now() - start;
    const { storage_document_updates } = await import("../../db/schemas.pg");
    const updates = await f.db.select().from(storage_document_updates);
    samples.push({
      priorEdits,
      meanMilliseconds: elapsed / 100,
      largestUpdateBytes: Math.max(0, ...updates.map((row) => row.update.length)),
    });
    console.log(JSON.stringify(samples.at(-1)));
    const edits = priorEdits.toLocaleString("en-US");
    recordMeasurement({
      metric: `save-after-${priorEdits}`,
      label: `Record save after ${edits} edits`,
      unit: "ms",
      value: elapsed / 100,
    });
  }
  recordPeakMemory("document-storage-memory", "Record storage peak memory");
} finally {
  await f.close();
}
