import { expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { coreOwnerId, rememberResourceNumber, resourceNumbers, resourceNumbersDocumentId } from "pstdio-sync";
import { createDb } from "../db/connection.pglite";
import {
  storage_current_records,
  storage_documents,
  storage_resource_aliases,
  storage_resource_identities,
  storage_resource_projections,
} from "../db/schemas.pg";
import { createExtensionResourceSequencesDBService } from "./extension-resource-sequences";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { createProjectsDBService } from "./projects/projects";

test("closing an unused number service leaves its old source unopened for the next start", async () => {
  const connection = await createDb({ path: ":memory:" });
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Unused old numbers" });
    await connection.db.insert(storage_documents).values({
      workbench_id: project.id,
      extension_id: coreOwnerId,
      document_id: resourceNumbersDocumentId,
      state: new Uint8Array([1]),
    });
    const service = createExtensionResourceSequencesDBService(connection.db);
    await expect(service.flush()).resolves.toBeUndefined();
    expect((await connection.db.select().from(storage_documents))[0]!.state).toEqual(new Uint8Array([1]));
  } finally {
    await connection.close();
  }
});

test("existing numbers and aliases move once into records and retain their allocation floor", async () => {
  const connection = await createDb({ path: ":memory:" });
  const documents = createDocumentStorageDBService(connection.db);
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Legacy numbers" });
    const owner = { workbenchId: project.id, extensionId: coreOwnerId };
    await documents.documents.open(resourceNumbersDocumentId).transaction(owner, async ({ document }) => {
      const resource = { id: "old-ticket", extensionId: "example.items", kind: "item", prefix: "IT", value: 7 };
      rememberResourceNumber(document, { ...resource, value: 50 });
      resourceNumbers(document).set(resource.id, resource);
      rememberResourceNumber(document, resource);
    });
    await connection.db.insert(storage_resource_projections).values({ workbench_id: project.id, revision: 0 });
    await connection.db.insert(storage_resource_identities).values({
      workbench_id: project.id,
      resource_id: "z-deleted-by-old-writer",
      extension_id: "example.items",
      kind: "item",
      shorthand: "IT-7",
    });
    await connection.db
      .insert(storage_resource_aliases)
      .values({ workbench_id: project.id, resource_id: "z-deleted-by-old-writer", shorthand: "IT-99" });
    const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
    const service = createExtensionResourceSequencesDBService(connection.db, documents);
    expect(await service.identity({ ...input, id: "old-ticket" })).toEqual({
      id: "old-ticket",
      kind: "item",
      shorthand: "IT-7",
      aliases: ["IT-50"],
    });
    expect(await service.identity({ ...input, id: "z-deleted-by-old-writer" })).toBeNull();
    expect((await service.allocate(input)).shorthand).toBe("IT-51");
    expect(
      await connection.db
        .select()
        .from(storage_documents)
        .where(eq(storage_documents.document_id, resourceNumbersDocumentId)),
    ).toEqual([]);
    const source = await connection.db.select().from(storage_documents);
    const restarted = createExtensionResourceSequencesDBService(connection.db, documents);
    expect((await restarted.findByShorthand({ ...input, shorthand: "IT-50" })).map((r) => r.id)).toEqual([
      "old-ticket",
    ]);
    expect(await connection.db.select().from(storage_documents)).toEqual(source);
  } finally {
    await documents.flushStatistics();
    await connection.close();
  }
});

test("a failed move rolls every batch back and a later start can retry the original source", async () => {
  const connection = await createDb({ path: ":memory:" });
  const documents = createDocumentStorageDBService(connection.db);
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Interrupted move" });
    const owner = { workbenchId: project.id, extensionId: coreOwnerId };
    await documents.documents.open(resourceNumbersDocumentId).transaction(owner, async ({ document }) => {
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
    });
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
                      if (++batches === 2) throw new Error("Interrupted move");
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
    const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
    const failed = createExtensionResourceSequencesDBService(connection.db, failingDocuments);
    await expect(failed.identity({ ...input, id: "item-0" })).rejects.toThrow("Interrupted move");
    expect(await connection.db.select().from(storage_current_records)).toEqual([]);
    expect((await connection.db.select().from(storage_documents)).map((row) => row.document_id)).toEqual([
      resourceNumbersDocumentId,
    ]);
    const retried = createExtensionResourceSequencesDBService(connection.db, documents);
    expect((await retried.identity({ ...input, id: "item-100" }))?.shorthand).toBe("IT-101");
    expect((await retried.allocate(input)).shorthand).toBe("IT-102");
  } finally {
    await documents.flushStatistics();
    await connection.close();
  }
});
