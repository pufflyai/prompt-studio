import { expect, test } from "bun:test";
import { rememberResourceNumber, resourceNumbers } from "pstdio-sync/records";
import * as Y from "yjs";
import { createDb } from "../db/connection.pglite";
import { storage_current_records } from "../db/schemas.pg";
import { createExtensionResourceSequencesDBService } from "./extension-resource-sequences";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { createProjectsDBService } from "./projects/projects";

test("received legacy number documents import through the public adapter and retain aliases and allocation floors", async () => {
  const connection = await createDb({ path: ":memory:" });
  const document = new Y.Doc();
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Received numbers" });
    const resource = { id: "old-ticket", extensionId: "example.items", kind: "item", prefix: "IT", value: 7 };
    resourceNumbers(document).set(resource.id, resource);
    rememberResourceNumber(document, { ...resource, value: 50 });
    const source = Y.encodeStateAsUpdate(document);
    const service = createExtensionResourceSequencesDBService(connection.db);
    await service.importLegacy(project.id, document);
    const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
    expect(await service.identity({ ...input, id: resource.id })).toEqual({
      id: resource.id,
      kind: "item",
      shorthand: "IT-7",
      aliases: ["IT-50"],
    });
    expect((await service.allocate(input)).shorthand).toBe("IT-51");
    await service.importLegacy(project.id, document);
    expect((await service.findByShorthand({ ...input, shorthand: "IT-50" })).map((row) => row.id)).toEqual([
      resource.id,
    ]);
    expect(Y.encodeStateAsUpdate(document)).toEqual(source);
  } finally {
    document.destroy();
    await connection.close();
  }
});

test("a failed received number import rolls back every page and the original document can be retried", async () => {
  const connection = await createDb({ path: ":memory:" });
  const documents = createDocumentStorageDBService(connection.db);
  const document = new Y.Doc();
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Interrupted received numbers" });
    for (let index = 0; index < 101; index++) {
      const resource = {
        id: `item-${index}`,
        extensionId: "example.items",
        kind: "item",
        prefix: "IT",
        value: index + 1,
      };
      resourceNumbers(document).set(resource.id, resource);
      rememberResourceNumber(document, resource);
    }
    let interrupted = false;
    const failingDocuments = {
      ...documents,
      open: (input: Parameters<typeof documents.open>[0]) => {
        const storage = documents.open(input);
        return {
          ...storage,
          records: {
            ...storage.records,
            transaction: <T>(run: Parameters<typeof storage.records.transaction<T>>[0]) =>
              storage.records.transaction(async (records, tx) => {
                let batches = 0;
                return run(
                  {
                    ...records,
                    commit: async (group) => {
                      if (++batches === 2 && !interrupted) {
                        interrupted = true;
                        throw new Error("Interrupted move");
                      }
                      return records.commit(group);
                    },
                  },
                  tx,
                );
              }),
          },
        };
      },
    };
    const service = createExtensionResourceSequencesDBService(connection.db, failingDocuments);
    const source = Y.encodeStateAsUpdate(document);
    await expect(service.importLegacy(project.id, document)).rejects.toThrow("Interrupted move");
    expect(await connection.db.select().from(storage_current_records)).toEqual([]);
    expect(Y.encodeStateAsUpdate(document)).toEqual(source);
    await service.importLegacy(project.id, document);
    const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
    expect((await service.identity({ ...input, id: "item-100" }))?.shorthand).toBe("IT-101");
    expect((await service.allocate(input)).shorthand).toBe("IT-102");
  } finally {
    document.destroy();
    await documents.flushStatistics();
    await connection.close();
  }
});
