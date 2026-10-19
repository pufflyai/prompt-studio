import { fingerprint } from "../fingerprint";
import { backupManifestSchema } from "../retention";
import { type Asset, jsonSchema, type Scope } from "../wire";
import { publicCoveredSnapshot, recoveryAssets, snapshotHash } from "./covered-state";
import type { CoveredStore } from "./covered-store";
import { own } from "./dictionary";
import type { TestObjects } from "./objects";

export function createCoveredBackup(store: CoveredStore, objects: TestObjects) {
  async function capture(scope: Scope) {
    // Holding the reference publication boundary also pins the exact captured state.
    return store.transaction(scope, async (state) => {
      const snapshot = publicCoveredSnapshot(state);
      const copiesScope = { ...scope, workbenchId: `${scope.workbenchId}/backup/${crypto.randomUUID()}` };
      const assets = recoveryAssets(state);
      await Promise.all(
        assets.map(async (asset) => {
          const bytes = await objects.get(scope, asset);
          if (!bytes) throw new Error("incomplete backup");
          await objects.put(copiesScope, asset, bytes);
          if (!(await objects.get(copiesScope, asset))) throw new Error("unverified backup copy");
        }),
      );
      const manifest = backupManifestSchema.parse({
        protocolVersion: 2,
        snapshot,
        copiesScope,
        assets,
        packages: [],
        snapshotHash: await snapshotHash(state),
        coverage: Object.values(state.acknowledgements),
      });
      const bytes = new TextEncoder().encode(JSON.stringify(manifest));
      const manifestAsset: Asset = {
        sha256: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
        byteLength: bytes.length,
        mediaType: "application/json",
      };
      await objects.put(copiesScope, manifestAsset, bytes);
      if (!(await objects.get(copiesScope, manifestAsset))) throw new Error("unverified manifest");
      const coverage = {
        cut: state.cut,
        epoch: state.epoch,
        generation: state.generation,
        snapshotHash: await snapshotHash(state),
        manifestHash: manifestAsset.sha256,
      };
      state.backup = coverage;
      return { copiesScope, manifestAsset, checksum: await fingerprint(jsonSchema.parse(manifest)) };
    });
  }
  async function restore(scope: Scope, backup: Awaited<ReturnType<typeof capture>>) {
    const bytes = await objects.get(backup.copiesScope, backup.manifestAsset);
    if (!bytes) throw new Error("backup manifest unavailable");
    const manifest = backupManifestSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
    if (
      (await fingerprint(jsonSchema.parse(manifest))) !== backup.checksum ||
      (await fingerprint(scope)) !== (await fingerprint(manifest.snapshot.scope))
    )
      throw new Error("backup checksum or scope mismatch");
    return store.transaction(scope, async (state) => {
      await Promise.all(
        manifest.assets.map(async (asset) => {
          const copy = await objects.get(manifest.copiesScope, asset);
          if (!copy) throw new Error("backup recovery material unavailable");
          await objects.put(scope, asset, copy);
          if (!(await objects.get(scope, asset))) throw new Error("unverified restored asset");
        }),
      );
      const writers = Object.fromEntries(
        Object.keys(state.writers).map((id) => [id, own(manifest.snapshot.writers, id) ?? { floor: 0 }]),
      );
      const { retainedBranches: _roots, ...snapshot } = manifest.snapshot;
      Object.assign(state, snapshot, {
        epoch: crypto.randomUUID(),
        writers,
        assets: [...new Map([...state.assets, ...manifest.assets].map((asset) => [asset.sha256, asset])).values()],
        // Old coverage carries recovery roots, but its old epoch never covers the restored stream.
        acknowledgements: Object.fromEntries(
          manifest.coverage
            .filter((ack) => Object.hasOwn(writers, ack.environmentId))
            .map((ack) => [ack.environmentId, ack]),
        ),
        barrier: null,
        backup: null,
      });
      return snapshotHash(state);
    });
  }
  return { capture, restore };
}
