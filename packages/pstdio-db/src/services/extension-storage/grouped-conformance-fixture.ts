import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAssetBytesStorage } from "pstdio-storage";
import type { RelayAdapter } from "pstdio-sync";
import type { Asset, Peer, RecordEdit, Scope } from "pstdio-sync-contracts";
import { type createConformanceServices, readConformanceRecord } from "pstdio-sync-contracts/conformance";
import { createDb } from "../../db/connection.pglite";
import { projects } from "../../db/schemas.pg";
import { createGroupedStorageDBService } from "./grouped-storage";

interface SyncOptions {
  peer?: Peer;
  crash?: "before-commit" | "after-commit";
  upload?: boolean;
}

export const createGroupedConformanceFixture = async (
  services: Awaited<ReturnType<typeof createConformanceServices>>,
) => {
  const root = await mkdtemp(join(tmpdir(), "grouped-conformance-"));
  const stores = await Promise.all(
    ["a", "b", "c"].map(async (environmentId) => ({
      environmentId,
      connection: await createDb({ path: join(root, "databases", environmentId) }),
      bytes: createAssetBytesStorage(join(root, "bytes", environmentId)),
    })),
  );
  const scenario = (
    scope: Scope = { accountId: "test-owner", workbenchId: crypto.randomUUID(), extensionId: "test-extension" },
  ) => {
    const owner = { workbenchId: scope.workbenchId, extensionId: scope.extensionId };
    const clients = stores.map((store) => {
      const known = new Map<string, Asset>();
      const adapter = (options: SyncOptions = {}) => {
        const result: RelayAdapter = {
          scope,
          peer: options.peer,
          snapshot: () => services.relay.snapshot(scope),
          submit: (mutation) => services.relay.submit(mutation, options.crash),
          assets: {
            put: async (asset, source) => {
              if (options.upload === false) return;
              await services.objects.put(
                scope,
                asset,
                new Uint8Array(await new Response(await source()).arrayBuffer()),
              );
            },
            get: async (asset, offset) => {
              const bytes = await services.objects.get(scope, asset);
              return bytes ? new Blob([bytes.slice(offset)]).stream() : null;
            },
          },
        };
        return result;
      };
      const current = () =>
        createGroupedStorageDBService(store.connection.db).open({
          owner,
          environmentId: store.environmentId,
          assets: {
            verifyComplete: async (assets) => {
              for (const asset of assets) await store.bytes.verify(owner, asset);
            },
            read: (asset) => store.bytes.open(owner, asset),
            receive: async (asset, source) => {
              const operationId = `receive:${asset.sha256}`;
              const offset = await store.bytes.progress(owner, operationId);
              await store.bytes.append(owner, operationId, offset, await source(offset, new AbortController().signal));
              await store.bytes.publish(owner, operationId, asset);
              known.set(asset.sha256, asset);
            },
          },
        });
      let projectReady: Promise<unknown> | undefined;
      const ensure = async () => {
        if (!projectReady) {
          const timestamp = new Date().toISOString();
          projectReady = Promise.resolve(
            store.connection.db
              .insert(projects)
              .values({
                id: scope.workbenchId,
                name: "Conformance",
                shorthand: scope.workbenchId,
                created_at: timestamp,
                updated_at: timestamp,
              })
              .onConflictDoNothing(),
          );
        }
        await projectReady;
        return current();
      };
      const bound = async () => {
        const api = await ensure();
        if (!(await api.readState()).accepted) await api.synchronize(adapter());
        return api;
      };
      return {
        async edit(edits: RecordEdit[]) {
          const api = await bound();
          const state = await api.readState();
          const inputs = await Promise.all(
            edits.map(async (edit) => {
              const previous = state.pending
                .filter((operation) => operation.changes.some((change) => change.recordId === edit.recordId))
                .at(-1);
              const base = await api.records.read(
                edit.recordId,
                previous ? { operationId: previous.operationId } : undefined,
              );
              return { ...edit, expectedRevision: base.revision };
            }),
          );
          const operationId = crypto.randomUUID();
          await api.records.commit({ operationId, edits: inputs });
          return api.mutation(operationId);
        },
        async resolve(
          conflictId: string,
          choose: "local" | "remote",
          handler?: { publishedRevision: string; handlerId: string },
        ) {
          const api = await bound();
          const inspection = await api.records.inspect(conflictId);
          const operationId = crypto.randomUUID();
          await api.records.resolve({
            operationId,
            conflictId,
            choose,
            handler,
            expectedConflicts: inspection.expectedConflicts,
            expectedInputs: inspection.expectedInputs,
            capturedOperationIds: inspection.capturedOperationIds,
          });
          return api.mutation(operationId);
        },
        async asset(content: string) {
          await ensure();
          const bytes = new TextEncoder().encode(content);
          const asset = {
            sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
            byteLength: bytes.length,
            mediaType: "image/png",
          };
          const operationId = crypto.randomUUID();
          await store.bytes.append(owner, operationId, 0, new Blob([bytes]).stream());
          await store.bytes.publish(owner, operationId, asset);
          known.set(asset.sha256, asset);
          return asset;
        },
        async state() {
          const api = await bound();
          const state = await api.readState();
          if (!state.accepted) throw new Error("Fixture has no relay snapshot");
          const pending = await Promise.all(state.pending.map((operation) => api.mutation(operation.operationId)));
          const blobs = Object.fromEntries(
            await Promise.all(
              [...known.values()].map(async (asset) => [
                asset.sha256,
                Buffer.from(await new Response(await store.bytes.open(owner, asset)).arrayBuffer()).toString("base64"),
              ]),
            ),
          );
          return {
            accepted: state.accepted,
            pending,
            blobs,
            records: Object.fromEntries(
              Object.entries(state.accepted.records).map(([id, record]) => [id, readConformanceRecord(record)]),
            ),
            working: Object.fromEntries(
              Object.entries(state.working).map(([id, record]) => [id, readConformanceRecord(record)]),
            ),
          };
        },
        async sync(options: SyncOptions = {}) {
          return (await ensure()).synchronize(adapter(options));
        },
        async restart() {
          await ensure();
          await store.connection.close();
          store.connection = await createDb({ path: join(root, "databases", store.environmentId) });
        },
      };
    });
    return { scope, clients, relay: services.relay, objects: services.objects };
  };
  return {
    scenario,
    async close() {
      await Promise.all(stores.map((store) => store.connection.close()));
      await services.close();
      await rm(root, { recursive: true, force: true });
    },
  };
};
