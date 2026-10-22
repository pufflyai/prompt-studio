import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createDocumentStorageDBService } from "./document-storage";

const database = await createDb({ path: Bun.argv[2]! });
const owner = { workbenchId: "crash-workbench", extensionId: "example.notes" };
const timestamp = new Date().toISOString();
await database.db.insert(projects).values({
  id: owner.workbenchId,
  name: "Crash recovery",
  shorthand: "CR",
  created_at: timestamp,
  updated_at: timestamp,
});
const { records } = createDocumentStorageDBService(database.db).open({ owner });
const outcome = await records.commit({
  operationId: "crash-group",
  edits: [
    { recordId: "one", expectedRevision: (await records.read("one")).revision, replace: "first" },
    { recordId: "two", expectedRevision: (await records.read("two")).revision, replace: "second" },
  ],
});
await Bun.write(Bun.stdout, `${JSON.stringify(outcome)}\n`);
setInterval(() => {}, 1000);
