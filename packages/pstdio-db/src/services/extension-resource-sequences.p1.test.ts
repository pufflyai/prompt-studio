import { expect, test } from "bun:test";
import { createDb } from "../db/connection.pglite";
import { createExtensionResourceSequencesDBService } from "./extension-resource-sequences";
import { createDocumentStorageDBService } from "./extension-storage/document-storage";
import { createProjectsDBService } from "./projects/projects";

test("allocating a number writes one core record without hydrating the identity owner document", async () => {
  const connection = await createDb({ path: ":memory:" });
  const phases: string[] = [];
  const documents = createDocumentStorageDBService(connection.db, undefined, (event) => phases.push(event.phase));
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Incremental identities" });
    const service = createExtensionResourceSequencesDBService(connection.db, documents);
    const allocated = await service.allocate({
      projectId: project.id,
      extensionId: "example.items",
      kind: "item",
      prefix: "IT",
    });
    expect(phases).not.toContain("document-loaded");
    const records = documents.open({ owner: { workbenchId: project.id, extensionId: "pstdio" } }).records;
    expect(await records.read(allocated.id)).toMatchObject({
      recordId: allocated.id,
      value: { id: allocated.id, extensionId: "example.items", kind: "item", prefix: "IT", value: 1, aliases: [] },
    });
    expect(await records.list()).toHaveLength(1);
  } finally {
    await documents.flushStatistics();
    await connection.close();
  }
});

test("resource identities remain unique across concurrent allocations and service restarts", async () => {
  const connection = await createDb({ path: ":memory:" });
  const documents = createDocumentStorageDBService(connection.db);
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Prompt Studio" });
    const service = createExtensionResourceSequencesDBService(connection.db, documents);
    const input = { projectId: project.id, extensionId: "pstdio.planner", kind: "ticket", prefix: "PS" };
    const settled = await Promise.allSettled(Array.from({ length: 20 }, () => service.allocate(input)));
    const results = settled.map((result) => {
      if (result.status === "rejected") throw result.reason;
      return result.value;
    });
    expect(new Set(results.map((result) => result.shorthand)).size).toBe(20);
    expect(new Set(results.map((result) => result.id)).size).toBe(20);
    const reopened = createExtensionResourceSequencesDBService(connection.db, documents);
    expect((await reopened.allocate(input)).shorthand).toBe("PS-21");
    await expect(service.allocate({ ...input, idPrefix: "INVALID" })).rejects.toThrow("ID prefix");
    const compact = await reopened.allocate({ ...input, idPrefix: "tk" });
    expect(compact.shorthand).toBe("PS-22");
    expect(compact.id).toMatch(/^tk_[0-9A-Za-z]{22}$/);
    expect(results[0]!.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(
      (await service.allocate({ ...input, extensionId: "pstdio.reports", kind: "report", prefix: "RP" })).shorthand,
    ).toBe("RP-1");
    await expect(service.allocate({ ...input, extensionId: "pstdio.other" })).rejects.toThrow("pstdio.planner");
    const other = await createProjectsDBService(connection.db).create({ name: "Other" });
    expect((await service.allocate({ ...input, projectId: other.id })).shorthand).toBe("PS-1");
  } finally {
    await documents.flushStatistics();
    await connection.close();
  }
});

test("selected identities survive restart and batch reads never hydrate the identity document", async () => {
  const connection = await createDb({ path: ":memory:" });
  const writer = createDocumentStorageDBService(connection.db);
  try {
    const project = await createProjectsDBService(connection.db).create({ name: "Selected identities" });
    const input = { projectId: project.id, extensionId: "example.items", kind: "item", prefix: "IT" };
    const first = createExtensionResourceSequencesDBService(connection.db, writer);
    const a = await first.allocate(input);
    const b = await first.allocate(input);
    const events: string[] = [];
    const documents = createDocumentStorageDBService(connection.db, undefined, (event) => events.push(event.phase));
    const reopened = createExtensionResourceSequencesDBService(connection.db, documents);
    const identities = await reopened.identityMany({ ...input, ids: [b.id, "missing", a.id] });
    expect(identities.map((resource) => resource?.shorthand ?? null)).toEqual(["IT-2", null, "IT-1"]);
    expect((await reopened.identity({ ...input, id: a.id }))?.shorthand).toBe("IT-1");
    expect((await reopened.findByShorthand({ ...input, shorthand: "IT-2" })).map((resource) => resource.id)).toEqual([
      b.id,
    ]);
    expect(events).not.toContain("document-loaded");
  } finally {
    await writer.flushStatistics();
    await connection.close();
  }
});
