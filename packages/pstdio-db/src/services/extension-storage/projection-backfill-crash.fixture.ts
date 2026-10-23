import { writeSync } from "node:fs";
import { createDb } from "../../db/connection.pglite";
import { createDocumentStorageDBService } from "./document-storage";

const database = await createDb({ path: Bun.argv[2]! });
const owner = { workbenchId: "upgrade-workbench", extensionId: "example.notes" };
const storage = createDocumentStorageDBService(database.db, undefined, (event) => {
  if (event.phase !== "records-projected") return;
  // This diagnostic runs inside the transaction, after rows exist but before commit.
  writeSync(1, `${JSON.stringify(event)}\n`);
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0);
}).open({ owner });
await storage.records.defineIndexes([]);
throw new Error("Backfill unexpectedly committed before termination");
