import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const writeStoragePackageConsumer = (directory: string) => {
  writeFileSync(
    join(directory, "storage-consumer.ts"),
    `
import { createMemoryStorage } from "@pstdio/sdk/testing";
import type { StorageGroup, StorageSaveOutcome } from "@pstdio/sdk/extensions";
const storage = createMemoryStorage({ kv: { note: "seeded" } });
const note = await storage.records.read(storage.records.id("note"));
if (note.value !== "seeded") throw new Error("Storage seeds were not ready");
const asset = await storage.assets.stage({ operationId: "asset", source: new Blob(["retained"]) });
const group: StorageGroup = { operationId: "save", edits: [{ recordId: note.recordId, expectedRevision: note.revision, replace: "first", asset }] };
const saved: StorageSaveOutcome = await storage.records.commit(group);
if (saved.status !== "saved-locally") throw new Error("Local save invented relay acceptance");
const conflict = await storage.records.commit({ operationId: "other", edits: [{ recordId: note.recordId, expectedRevision: note.revision, replace: "second" }] });
if (conflict.status !== "conflict") throw new Error("Stale caller was not retained");
const inspected = await storage.records.inspect(conflict.conflictId);
await storage.records.resolve({ operationId: "resolve", conflictId: inspected.conflictId, expectedConflicts: inspected.expectedConflicts, capturedOperationIds: inspected.capturedOperationIds, expectedInputs: inspected.expectedInputs, choose: "local" });
if (await storage.get("note") !== "second") throw new Error("Public resolution lost legacy interoperability");
if (await new Response(await storage.assets.read(asset)).text() !== "retained") throw new Error("Asset bytes were lost");
const current = await storage.records.commit({ operationId: "current", edits: [{ recordId: note.recordId, replace: "third" }] });
if (current.state !== "saved-locally" || await storage.get("note") !== "third") throw new Error("Save without a revision did not edit the current value");
`,
  );
};
