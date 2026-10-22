import { writeFileSync } from "node:fs";
import { join } from "node:path";

export const writeStoragePackageConsumer = (directory: string) => {
  writeFileSync(
    join(directory, "storage-consumer.ts"),
    `
import { createMemoryStorage, createMemoryStorageDevices, type MemoryStorageReplacement } from "@pstdio/sdk/testing";
import type { StorageGroup, StorageSaveOutcome } from "@pstdio/sdk/extensions";
const storage = createMemoryStorage({ kv: { note: "seeded" } });
const note = await storage.records.read(storage.records.id("note"));
if (note.value !== "seeded") throw new Error("Storage seeds were not ready");
const asset = await storage.assets.stage({ operationId: "asset", source: new Blob(["retained"]) });
const group: StorageGroup = { operationId: "save", edits: [{ recordId: note.recordId, expectedRevision: note.revision, replace: "first", asset }] };
const saved: StorageSaveOutcome = await storage.records.commit(group);
if (saved.status !== "saved-locally") throw new Error("Local save invented relay acceptance");
const other = await storage.records.commit({ operationId: "other", edits: [{ recordId: note.recordId, expectedRevision: note.revision, replace: "second" }] });
if (other.state !== "saved-locally") throw new Error("An earlier revision prevented a save");
if (await storage.get("note") !== "second") throw new Error("Public records lost legacy interoperability");
await storage.records.commit(group);
if (await storage.get("note") !== "second") throw new Error("Retrying an earlier operation overwrote a later save");
if (await new Response(await storage.assets.read(asset)).text() !== "retained") throw new Error("Asset bytes were lost");
const current = await storage.records.commit({ operationId: "current", edits: [{ recordId: note.recordId, replace: "third" }] });
if (current.state !== "saved-locally" || await storage.get("note") !== "third") throw new Error("Save without a revision did not edit the current value");
const pair = await createMemoryStorageDevices({ kv: { setting: { title: "Before", enabled: false } } });
const [first, second] = pair.devices;
await first.set("setting", { title: "After", enabled: false });
await second.set("setting", { title: "Before", enabled: true });
if ((await pair.merge()).length) throw new Error("Independent edits were reported as replacements");
for (const device of pair.devices) {
  const value = await device.get<{ title: string; enabled: boolean }>("setting");
  if (value?.title !== "After" || !value.enabled) throw new Error("Offline device edits were lost");
}
await first.set("setting", { title: "Left", enabled: true });
await second.set("setting", { title: "Right", enabled: true });
const replacements: MemoryStorageReplacement[] = await pair.merge();
const kept = await first.get<{ title: string }>("setting");
if (replacements.length !== 1 || replacements[0].path.join(".") !== "value.title" || replacements[0].kept !== kept?.title)
  throw new Error("The replacement report did not match the merged field");
if (JSON.stringify(await first.get("setting")) !== JSON.stringify(await second.get("setting")))
  throw new Error("The two merge orders disagreed");
`,
  );
};
