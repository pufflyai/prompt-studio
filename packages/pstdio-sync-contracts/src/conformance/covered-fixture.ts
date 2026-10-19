import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { type CheckpointGroup, sealCheckpoint } from "../checkpoint";
import { fingerprint } from "../fingerprint";
import type { Scope } from "../wire";
import { createCoveredBackup } from "./covered-backup";
import { type InstalledCoverage, reconcileCoveredLocal } from "./covered-local";
import { recoveryAssets, requiredAssets } from "./covered-state";
import { createCoveredStore, snapshotHash } from "./covered-store";
import { put } from "./dictionary";
import { blank, sharedChange } from "./documents";
import { createObjects } from "./objects";

export async function createCoveredFixture() {
  if (!process.env.SYNC_TEST_DATABASE_URL || !process.env.SYNC_TEST_OBJECT_ENDPOINT)
    throw new Error("Use the isolated conformance runner");
  const root = await mkdtemp(join(tmpdir(), "covered-sync-"));
  const objects = createObjects(process.env.SYNC_TEST_OBJECT_ENDPOINT);
  await objects.initialize();
  const store = await createCoveredStore(process.env.SYNC_TEST_DATABASE_URL, objects);
  const backups = createCoveredBackup(store, objects);
  const local = await PGlite.create(join(root, "environments"));
  await local.exec(
    "CREATE TABLE installed (scope text, environment text, state jsonb, PRIMARY KEY(scope, environment))",
  );
  return {
    async scenario() {
      const scope: Scope = { accountId: "owner", workbenchId: crypto.randomUUID(), extensionId: "documents" };
      const sequences = new Map<string, number>();
      const snapshot = () => store.snapshot(scope);
      const group = async (environmentId: string, text: string, revision?: number, parents: string[] = []) => {
        const state = await snapshot();
        const current = state.records.document ?? blank("document");
        const projection = state.records.projection ?? blank("projection");
        const bytes = new TextEncoder().encode(text);
        const asset = {
          sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
          byteLength: bytes.length,
          mediaType: "text/plain",
        };
        await objects.put(scope, asset, bytes);
        const sequence = (sequences.get(environmentId) ?? 0) + 1;
        sequences.set(environmentId, sequence);
        return sealCheckpoint({
          protocolVersion: 2,
          scope,
          epoch: state.epoch,
          generation: state.generation,
          environmentId,
          sequence,
          parents,
          document: { recordId: "document", generation: state.documents.document ?? 0, recoveryRevision: sequence },
          changes: [
            {
              recordId: "document",
              expectedRevision: current.revision,
              baseDeleted: false,
              shared: await sharedChange(current, [{ kind: "text.insert", index: 0, text }]),
            },
            {
              recordId: "projection",
              expectedRevision: revision ?? projection.revision,
              baseDeleted: false,
              value: { expected: await fingerprint(revision === 0 ? null : projection.value), next: text },
              asset: { base: revision === 0 ? null : projection.asset, next: asset },
            },
          ],
        });
      };
      const acknowledge = async (authenticated: string, environmentId: string, overrides = {}) => {
        const state = await snapshot();
        return store.acknowledge(scope, authenticated, {
          protocolVersion: 2,
          scope,
          epoch: state.epoch,
          generation: state.generation,
          cut: state.cut,
          snapshotHash: await snapshotHash(state),
          branches: [],
          recovery: [],
          environmentId,
          ...overrides,
        });
      };
      return {
        scope,
        snapshot,
        snapshotHash: async () => snapshotHash(await snapshot()),
        group,
        reseal: sealCheckpoint,
        async seed(records: Parameters<typeof requiredAssets>[0]["records"]) {
          await store.transaction(scope, async (state) => {
            state.records = structuredClone(records);
          });
        },
        async upload(asset: Parameters<typeof objects.put>[1], bytes: Uint8Array) {
          await objects.put(scope, asset, bytes);
        },
        submit: (group: CheckpointGroup, fault?: string) => store.submit(scope, group.environmentId, group, fault),
        acknowledge,
        async cover(environments: string[], branches: Record<string, string[]> = {}) {
          const downloaded = new Map<string, string>();
          for (const environmentId of environments) {
            const state = await snapshot();
            const blobs = await Promise.all(
              recoveryAssets(state).map(async (asset) => {
                const existing = downloaded.get(asset.sha256);
                if (existing !== undefined) return { asset, bytes: existing };
                const bytes = await objects.get(scope, asset);
                if (!bytes) throw new Error("Incomplete local installation");
                const encoded = Buffer.from(bytes).toString("base64");
                downloaded.set(asset.sha256, encoded);
                return { asset, bytes: encoded };
              }),
            );
            // The durable install and accounted local branches precede the network acknowledgement.
            await local.query(
              "INSERT INTO installed VALUES($1,$2,$3) ON CONFLICT(scope,environment) DO UPDATE SET state=$3",
              [
                JSON.stringify(scope),
                environmentId,
                { snapshot: state, blobs, branches: branches[environmentId] ?? [] },
              ],
            );
            await acknowledge(environmentId, environmentId, { branches: branches[environmentId] ?? [] });
          }
        },
        backup: () => backups.capture(scope),
        restore: (backup: Awaited<ReturnType<typeof backups.capture>>) => backups.restore(scope, backup),
        compact: (fault?: string, afterRetirement?: () => Promise<void>) =>
          store.compact(scope, fault, afterRetirement),
        pin: (assets: Parameters<typeof store.pin>[1]) => store.pin(scope, assets),
        unpin: (id: string) =>
          store.transaction(scope, async (state) => {
            delete state.pins[id];
          }),
        readAsset: (asset: Parameters<typeof objects.get>[1]) => objects.get(scope, asset),
        eraseAsset: (asset: Parameters<typeof objects.remove>[1]) => objects.remove(scope, asset),
        requiredAssets: async () => requiredAssets(await snapshot()),
        async enroll(environmentId: string) {
          await store.transaction(scope, async (state) => {
            put(state.writers, environmentId, { floor: 0 });
          });
          const state = await snapshot();
          const assets = requiredAssets(state);
          const blobs = await Promise.all(
            assets.map(async (asset) => {
              const bytes = await objects.get(scope, asset);
              if (!bytes) throw new Error("Incomplete enrollment asset closure");
              return { asset, bytes: Buffer.from(bytes).toString("base64") };
            }),
          );
          await local.query("INSERT INTO installed VALUES($1,$2,$3)", [
            JSON.stringify(scope),
            environmentId,
            { snapshot: state, blobs, branches: [] },
          ]);
          await acknowledge(environmentId, environmentId);
          return blobs.map((blob) => blob.asset);
        },
        async recoverLocal(environmentId: string) {
          const row = await local.query<{ state: InstalledCoverage }>(
            "SELECT state FROM installed WHERE scope=$1 AND environment=$2",
            [JSON.stringify(scope), environmentId],
          );
          if (!row.rows[0]) throw new Error("No local recovery installation");
          return reconcileCoveredLocal(row.rows[0].state, await snapshot());
        },
        async dropLocalBytes(environmentId: string) {
          await local.query(
            "UPDATE installed SET state=jsonb_set(state,'{blobs}','[]'::jsonb) WHERE scope=$1 AND environment=$2",
            [JSON.stringify(scope), environmentId],
          );
        },
        async eraseLiveAssets() {
          for (const asset of (await snapshot()).assets) await objects.remove(scope, asset);
        },
        beginBarrier: () => store.beginBarrier(scope, "document"),
        joinBarrier: (environmentId: string) => store.joinBarrier(scope, environmentId),
        rotate: () => store.rotateDocument(scope, "document"),
      };
    },
    async close() {
      await local.close();
      await store.close();
      objects.close();
      await rm(root, { recursive: true, force: true });
    },
  };
}
