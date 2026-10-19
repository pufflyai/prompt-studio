import type { ExtensionStorageApi } from "@pstdio/sdk/extensions";
import { createLegacyRecordStorage, createRecordStorage, type GroupedState, type GroupedStore } from "pstdio-sync";
import { type Snapshot, sealMutation } from "pstdio-sync-contracts";
import { createRecordAssets } from "../../features/extensions/command-environment/record-assets";
import type { artifactFilesFixture } from "./artifact-files.fixture";

export async function acceptedHandlerState(f: Awaited<ReturnType<typeof artifactFilesFixture>>) {
  const current = await f.storage.readState();
  const state: GroupedState = { owner: current.owner, accepted: null, journal: current.journal };
  const accepted: Snapshot = {
    protocolVersion: 2,
    generation: 0,
    covered: 0,
    writers: {},
    documents: {},
    retainedBranches: [],
    scope: { accountId: "fixture", ...f.owner },
    journalSequence: state.journal.length,
    checkpoint: { epoch: "seed", sequence: state.journal.length },
    records: current.working,
    receipts: {},
    conflicts: {},
    publishedRevision: "fixture",
  };
  // These setup writes are the accepted baseline, not save-handler checkpoint writes.
  accepted.scope = { accountId: "fixture", workbenchId: f.owner.workbenchId, extensionId: f.owner.extensionId };
  for (const [index, entry] of state.journal.entries()) {
    entry.mutation.position = { epoch: "seed", generation: 0, sequence: index + 1 };
    const { position, ...body } = entry.mutation;
    const mutation = await sealMutation({ protocolVersion: 2, scope: accepted.scope, ...body, ...position });
    accepted.receipts[mutation.operationId] = {
      mutation,
      fingerprint: mutation.fingerprint,
      operationId: mutation.operationId,
      order: index + 1,
      status: "accepted",
      checkpoint: { epoch: "seed", sequence: index + 1 },
    };
  }
  state.accepted = accepted;
  return state;
}

/** Test host port: projections and collections share the fork; disk never sees preparation. */
export function handlerPorts(
  f: Awaited<ReturnType<typeof artifactFilesFixture>>,
  store: GroupedStore,
  environmentId: string,
) {
  const raw = createRecordStorage({
    store,
    owner: f.owner,
    environmentId,
    assets: createRecordAssets(f.assets, f.owner),
  });
  const legacy = createLegacyRecordStorage({ store, owner: f.owner, environmentId }).scope(
    "project",
    f.owner.workbenchId,
  );
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
