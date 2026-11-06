import type { DocumentStore } from "pstdio-sync";
import type { DocumentSyncInput } from "pstdio-sync/relay";
import type { Doc } from "yjs";
import { z } from "zod";
import { recoveryChunkSchema } from "./chunks";
import { type RecoveryManifest, readRecoveryManifest } from "./manifest";
import { downloadRecoveryCapture, publishRecoveryCapture } from "./transfer";

const entrySchema = z.strictObject({
  deviceId: z.string().min(1).max(256),
  sourceId: z.string().min(1).max(256),
  root: recoveryChunkSchema,
});
type Entry = z.infer<typeof entrySchema>;
const key = (entry: Pick<Entry, "deviceId" | "sourceId">) => JSON.stringify([entry.deviceId, entry.sourceId]);
const entries = (document: Doc) =>
  [...document.getMap<unknown>("sources").entries()].map(([id, raw]) => {
    const entry = entrySchema.parse(raw);
    if (key(entry) !== id) throw new Error("Recovery catalog source identity changed");
    return entry;
  });
const verifySource = (entry: Entry, manifest: RecoveryManifest) => {
  if (entry.deviceId !== manifest.source.deviceId || entry.sourceId !== manifest.source.id)
    throw new Error("Recovery catalog does not match its completed source");
};

const catalogExtension = "pstdio.folder-recovery.catalog-v1";
export const isRecoveryCatalogOwner = (extensionId: string) => extensionId.startsWith(`["${catalogExtension}",`);

/** One encrypted private document discovers independent device/workspace roots.
 * Only acknowledged complete candidates enter it; failures keep the prior root. */
export const createRecoveryCatalog = (input: {
  projectId: string;
  accountId: string;
  managerOrigin: string;
  deviceId: string;
  documents: { open(name: string): DocumentStore };
}) => {
  const owner = {
    workbenchId: input.projectId,
    extensionId: JSON.stringify([catalogExtension, input.managerOrigin, input.accountId]),
  };
  const store = input.documents.open("records");
  type Transfer = Parameters<typeof publishRecoveryCapture>[0];
  const assertSpace = (chunks: Transfer["chunks"]) => {
    if (chunks.space.projectId !== input.projectId || chunks.space.spaceOwner !== input.accountId)
      throw new Error("Recovery catalog requires its account's private project space");
  };
  return {
    owner,
    store,
    list: () => store.transaction(owner, async ({ document }) => entries(document)),
    async publish(transfer: Omit<Transfer, "complete">) {
      assertSpace(transfer.chunks);
      const manifest = await readRecoveryManifest(transfer.chunks, transfer.candidate);
      if (manifest.source.deviceId !== input.deviceId)
        throw new Error("A recovery publisher cannot replace another source device");
      return publishRecoveryCapture({
        ...transfer,
        complete: async (root, completed) => {
          const entry = entrySchema.parse({ deviceId: input.deviceId, sourceId: completed.source.id, root });
          verifySource(entry, completed);
          await store.transaction(owner, async ({ document }) => {
            document.getMap("sources").set(key(entry), entry);
          });
        },
      });
    },
    references(transfer: Omit<Transfer, "candidate" | "complete">) {
      assertSpace(transfer.chunks);
      // Roots are immutable: one verified upload or download per connection attempt is enough.
      const uploaded = new Set<string>();
      const available = new Set<string>();
      const references: NonNullable<DocumentSyncInput["references"]> = {
        validate(document) {
          entries(document);
        },
        async upload(document) {
          const roots = [];
          for (const entry of entries(document)) {
            roots.push(entry.root.blobId);
            if (uploaded.has(entry.root.blobId)) continue;
            const manifest = await readRecoveryManifest(transfer.chunks, entry.root);
            verifySource(entry, manifest);
            await publishRecoveryCapture({ ...transfer, candidate: entry.root, complete: async () => {} });
            uploaded.add(entry.root.blobId);
          }
          return [...new Set(roots)];
        },
        async download(document) {
          for (const entry of entries(document)) {
            if (available.has(entry.root.blobId)) continue;
            verifySource(entry, await downloadRecoveryCapture({ ...transfer, candidate: entry.root }));
            available.add(entry.root.blobId);
          }
        },
      };
      return references;
    },
  };
};
