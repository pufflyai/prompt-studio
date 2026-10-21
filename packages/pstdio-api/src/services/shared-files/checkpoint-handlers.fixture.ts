import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createDocumentStorage, createLegacyRecordStorage, type DocumentStore } from "pstdio-sync";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import type { artifactFilesFixture } from "./artifact-files.fixture";

/** Test host port: projections and collections share the fork; disk never sees preparation. */
export function handlerPorts(f: Awaited<ReturnType<typeof artifactFilesFixture>>, store: DocumentStore) {
  const raw = createDocumentStorage({
    store,
    owner: f.owner,
    assets: createRecordAssets(f.assets, f.owner),
  });
  const legacy = createLegacyRecordStorage({ store, owner: f.owner }).scope("project", f.owner.workbenchId);
  const record = (path: string) => raw.records.read(f.recordId(`documents/${path}`));
  const mount = {
    exists: async (path: string) => {
      const file = await record(path);
      return file.exists && !file.deleted;
    },
    readText: async (path: string) => {
      const file = await record(path);
      if (!file.asset || file.deleted) throw new Error("File missing");
      return new Response(await f.assets.read(f.owner, file.asset)).text();
    },
    updateText: async (path: string, text: string) => {
      const before = await record(path);
      if (!before.exists || before.deleted) throw new Error("File missing");
      const asset = await f.assets.stage(f.owner, crypto.randomUUID(), new Blob([text], { type: "text/plain" }));
      await raw.records.commit({
        operationId: crypto.randomUUID(),
        edits: [{ recordId: before.recordId, expectedRevision: before.revision, replace: before.value, asset }],
      });
    },
    delete: async (path: string) => {
      const before = await record(path);
      await raw.records.commit({
        operationId: crypto.randomUUID(),
        edits: [{ recordId: before.recordId, expectedRevision: before.revision, deleted: true, asset: null }],
      });
    },
  };
  const storage = {
    collection(name: string) {
      const collection = legacy.collection(name);
      return {
        get: async (id: string) => (await collection.get(id))?.value,
        list: async () => (await collection.list()).map((item) => item.value),
        put: collection.set,
        update: async (id: string, value: Parameters<typeof collection.update>[1]) => {
          if (!(await collection.update(id, value))) throw new Error("Item missing");
        },
      };
    },
  } as unknown as ExtensionStorageApi;
  const events: unknown[] = [];
  return {
    raw,
    mount,
    storage,
    events,
    emit: async (...event: unknown[]) => {
      events.push(event);
    },
  };
}
