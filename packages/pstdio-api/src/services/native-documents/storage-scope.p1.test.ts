import { expect, test } from "bun:test";
import type { NativeTextTarget } from "pstdio-api-contracts";
import { createDb, createExtensionStorageDBService, projects } from "pstdio-db";
import { observeNativeDocument } from "../../features/native-documents/observe";
import { createNativeDocumentService } from "./documents";

test("native rooms admit record changes only for their captured backing source, including retirement", async () => {
  const database = await createDb({ path: ":memory:" });
  const timestamp = new Date().toISOString();
  const projectId = crypto.randomUUID();
  await database.db.insert(projects).values({
    id: projectId,
    name: "Notes",
    shorthand: "N",
    created_at: timestamp,
    updated_at: timestamp,
  });
  const storage = createExtensionStorageDBService(database.db);
  const owner = { workbenchId: projectId, extensionId: "example.notes" };
  const records = (await storage.open({ owner, textFields: [{ prefix: "note:", fields: ["/body"] }] })).records;
  await records.commit({
    operationId: "seed",
    edits: [
      { recordId: "note:a", replace: { body: "A" } },
      { recordId: "note:b", replace: { body: "B" } },
      { recordId: "presentation", replace: { zoom: 1 } },
    ],
  });
  const load = async (input: NativeTextTarget) => {
    if (!("fileRendererId" in input)) throw new Error("Expected file renderer");
    const recordId = `note:${input.fileRendererId}`;
    const address = await storage.resolveNativeRecordAddress(owner, {
      recordId,
      documentKey: input.fileRendererId.repeat(64),
    });
    return {
      ...address,
      owner,
      backingRecordId: recordId,
      content: {
        content: input.fileRendererId.toUpperCase(),
        documentSource: { kind: "record" as const, recordId, field: "/body" },
      },
      copy: undefined,
      fileStorageVersions: {},
      saveHandlerId: "unused",
      projectionTarget: { fileRendererId: input.fileRendererId, resource: undefined, pageParams: undefined },
    };
  };
  const service = createNativeDocumentService({
    storage,
    load,
    access: load,
    initialize: async (source) => {
      const declaration = source.content.documentSource;
      if (declaration?.kind !== "record") throw new Error("Expected record source");
      await records.bindText({
        recordId: declaration.recordId,
        field: declaration.field,
        documentKey: source.documentKey,
        content: source.content.content ?? "",
      });
    },
    save: async () => ({ fileStorageVersions: {} }),
    deviceId: "fixture",
    presenceIdentity: async () => ({ label: "Fixture", deviceName: "Fixture" }),
  });
  const stops: (() => void)[] = [];
  const watching: Promise<unknown>[] = [];
  const reads = { a: 0, b: 0 };
  const ready = { a: Promise.withResolvers<void>(), b: Promise.withResolvers<void>() };
  const requests: Record<string, { projectId: string; roomId: string; documentKey: string }> = {};
  try {
    for (const name of ["a", "b"] as const) {
      const opened = await service.open({ projectId, fileRendererId: name });
      const request = { projectId, roomId: opened.roomId, documentKey: opened.documentKey };
      requests[name] = request;
      watching.push(
        observeNativeDocument(
          {
            ...service,
            snapshot: (input) => {
              reads[name]++;
              return service.snapshot(input);
            },
          },
          request,
          {
            aborted: false,
            onAbort: (callback) => {
              stops.push(callback);
            },
            write: async (kind) => {
              if (kind === "document") ready[name].resolve();
            },
          },
        ),
      );
    }
    await Promise.all([ready.a.promise, ready.b.promise]);
    await records.commit({ operationId: "presentation", edits: [{ recordId: "presentation", set: { "/zoom": 2 } }] });
    await Bun.sleep(0);
    expect(reads).toEqual({ a: 1, b: 1 });
    await records.commit({ operationId: "a", edits: [{ recordId: "note:a", set: { "/body": "Updated" } }] });
    await service.snapshot(requests.a!);
    expect(reads.a).toBeGreaterThan(1);
    expect(reads.b).toBe(1);
    const beforeDelete = reads.a;
    await records.commit({ operationId: "delete", edits: [{ recordId: "note:a", deleted: true }] });
    await Bun.sleep(0);
    expect(reads.a).toBeGreaterThan(beforeDelete);
    expect(reads.b).toBe(1);
  } finally {
    for (const stop of stops) stop();
    await Promise.allSettled(watching);
    await service.dispose();
    await database.close();
  }
});
