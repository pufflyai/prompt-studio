import { applyRecordChange, blankRecord, type RelayAdapter } from "pstdio-sync";
import { automationsId, type Receipt, type Snapshot } from "pstdio-sync-contracts";
import type { createConformanceServices } from "pstdio-sync-contracts/conformance";

// Unit tests control delivery directly. The Docker suite uses the same adapter
// boundary against the PostgreSQL reference relay and real object storage.
export const createCatalogRelayFixture = (
  workbenchId: string,
  services?: Awaited<ReturnType<typeof createConformanceServices>>,
  extensionId = automationsId,
) => {
  const scope = { accountId: "owner", workbenchId, extensionId };
  if (services)
    return {
      scope,
      snapshot: () => services.relay.snapshot(scope),
      submit: (mutation) => services.relay.submit(mutation),
      assets: {
        put: async (asset, source) =>
          services.objects.put(scope, asset, new Uint8Array(await new Response(await source()).arrayBuffer())),
        get: async (asset, offset) => {
          const bytes = await services.objects.get(scope, asset);
          return bytes ? new Blob([bytes.slice(offset)]).stream() : null;
        },
      },
    } satisfies RelayAdapter;
  const snapshot: Snapshot = {
    protocolVersion: 1,
    scope,
    publishedRevision: "automations-v1",
    checkpoint: { epoch: "relay", sequence: 0 },
    journalSequence: 0,
    records: {},
    receipts: {},
    conflicts: {},
  };
  const assets = new Map<string, Uint8Array>();
  return {
    scope,
    snapshot: async () => structuredClone(snapshot),
    submit: async (mutation) => {
      const saved = snapshot.receipts[mutation.operationId];
      if (saved) return saved;
      for (const change of mutation.changes)
        snapshot.records[change.recordId] = applyRecordChange(
          snapshot.records[change.recordId] ?? blankRecord(change.recordId),
          change,
        );
      snapshot.checkpoint.sequence++;
      const receipt: Receipt = {
        status: "accepted",
        operationId: mutation.operationId,
        fingerprint: mutation.fingerprint,
        mutation,
        order: ++snapshot.journalSequence,
        checkpoint: { ...snapshot.checkpoint },
      };
      snapshot.receipts[mutation.operationId] = receipt;
      return receipt;
    },
    assets: {
      put: async (asset, source) => {
        assets.set(asset.sha256, new Uint8Array(await new Response(await source()).arrayBuffer()));
      },
      get: async (asset, offset) => {
        const bytes = assets.get(asset.sha256);
        return bytes ? new Blob([bytes.slice(offset)]).stream() : null;
      },
    },
  } satisfies RelayAdapter;
};
