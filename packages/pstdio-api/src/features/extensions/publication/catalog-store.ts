import type { GroupCommit } from "pstdio-sync/records";
import type { Asset, StorageRecord, TeamExtensionPolicy } from "pstdio-sync-contracts";
import { canonicalPublicationRecords } from "./identity-records";
import {
  assertOrdinaryExtensionChoices,
  ordinaryPublicationAllowed,
  publicationRemoved,
  stampTeamPolicyChoices,
} from "./team-policy";
import { type Publication, PublicationChangedError, packageMetadataSchema, selectionSchema } from "./types";

type CatalogLockedRecords = Pick<CatalogRecords, "read" | "commit">;
type Replacement = { extensionId: string; expectedRevision: string; beforeCommit?: () => Promise<void> };

const checkReplacement = async (records: CatalogLockedRecords, extensionId: string, replacement?: Replacement) => {
  if (!replacement) return;
  if (replacement.extensionId === extensionId) throw new Error("A replacement must retire a different extension.");
  const previous = await records.read(replacement.extensionId);
  if (previous.revision !== replacement.expectedRevision) throw new PublicationChangedError();
};

/** The publication catalog shares one ordered record owner and transaction lock. */
export interface CatalogRecords {
  read(id: string): Promise<StorageRecord>;
  list(): Promise<StorageRecord[]>;
  commit(group: GroupCommit): Promise<unknown>;
  transaction<T>(run: (records: CatalogLockedRecords) => Promise<T>): Promise<T>;
}

/** A mutable package selector points at one immutable metadata-and-bytes record. */
export const createPublicationCatalog = (input: {
  records: CatalogRecords;
  verifyComplete: (assets: Asset[]) => Promise<void>;
  authorizeWrite?: () => Promise<void>;
  readPolicy?: () => Promise<TeamExtensionPolicy[]>;
}) => {
  const records = canonicalPublicationRecords(input.records);
  const readPolicy = async () => (await input.readPolicy?.()) ?? [];
  const requireWrite = async (ids: string[] = []) => {
    await input.authorizeWrite?.();
    const policy = ids.length ? await readPolicy() : [];
    assertOrdinaryExtensionChoices(policy, ids);
    return policy;
  };
  // A selection without its matching package reads as unpublished, so one bad entry cannot break callers.
  // Activation still refuses it and keeps the current set.
  const resolve = async (selected: StorageRecord, reader: Pick<CatalogRecords, "read">) => {
    // `damaged` marks a selection whose package cannot be read; version checks still apply to it.
    const unpublished = {
      ...selected,
      value: null,
      asset: null,
      damaged: !selected.deleted && selected.value !== null,
    };
    const selection = selectionSchema.safeParse(selected.value);
    if (publicationRemoved(selected)) return { ...unpublished, deleted: true, damaged: false };
    if (selected.deleted || !selection.success) return unpublished;
    const pkg = await reader.read(`package:${selection.data.revision}`);
    const metadata = packageMetadataSchema.safeParse(pkg.value);
    if (
      !metadata.success ||
      metadata.data.extensionId !== selected.recordId ||
      pkg.asset?.sha256 !== selection.data.revision
    )
      return unpublished;
    return { ...selected, value: { ...metadata.data, ...selection.data }, asset: pkg.asset, damaged: false };
  };
  const view = (reader: Pick<CatalogRecords, "read">) => ({
    records: reader,
    read: async (id: string) => resolve(await reader.read(id), reader),
  });
  // Reads and the following commit share one owner lock, so a stale caller cannot overwrite a newer choice.
  const change = async <T>(
    id: string,
    expectedRevision: string | undefined,
    action: (catalog: ReturnType<typeof view> & { records: CatalogLockedRecords }) => Promise<T>,
    additionalIds: string[] = [],
  ) => {
    const policy = await requireWrite([id, ...additionalIds]);
    return records.transaction(async (locked) => {
      const record = await locked.read(id);
      if (expectedRevision !== undefined && record.revision !== expectedRevision) throw new PublicationChangedError();
      const guarded = {
        ...locked,
        commit: async (group: GroupCommit) => locked.commit(await stampTeamPolicyChoices(locked, policy, group)),
      };
      return action({ ...view(guarded), records: guarded });
    });
  };
  return {
    ...view(records),
    records,
    change,
    requireWrite,
    readPolicy,
    readOrdinary: async (id: string, policy: TeamExtensionPolicy[]) => {
      const selected = await records.read(id);
      return ordinaryPublicationAllowed(policy, id, selected.value) ? resolve(selected, records) : null;
    },
    list: async () => {
      const policy = await readPolicy();
      return (
        await Promise.all(
          (
            await records.list()
          )
            .filter(
              (record) =>
                !record.recordId.startsWith("package:") &&
                !record.deleted &&
                ordinaryPublicationAllowed(policy, record.recordId, record.value),
            )
            .map((record) => resolve(record, records)),
        )
      ).filter((record) => !record.deleted);
    },
    select: async (publication: Publication, asset: Asset, expectedRevision?: string, replacement?: Replacement) => {
      if (asset.sha256 !== publication.revision) throw new Error("Published package identity mismatch");
      await requireWrite([publication.extensionId, ...(replacement ? [replacement.extensionId] : [])]);
      // Hashing package bytes stays outside the owner lock.
      await input.verifyComplete([asset]);
      // Local extension choices use the database lock too; read them before taking the catalog lock.
      // Both shared selectors are still compared and replaced together inside the transaction.
      await replacement?.beforeCommit?.();
      return change(
        publication.extensionId,
        expectedRevision,
        async ({ records }) => {
          await checkReplacement(records, publication.extensionId, replacement);
          const packageId = `package:${publication.revision}`;
          const existing = await records.read(packageId);
          if (
            existing.exists &&
            (existing.deleted ||
              existing.asset?.sha256 !== asset.sha256 ||
              !packageMetadataSchema.safeParse(existing.value).success ||
              (existing.value as { extensionId: string }).extensionId !== publication.extensionId ||
              (existing.value as { version: string }).version !== publication.version)
          )
            throw new Error("Published package identity mismatch");
          return records.commit({
            operationId: crypto.randomUUID(),
            edits: [
              ...(existing.exists
                ? []
                : [
                    {
                      recordId: packageId,
                      replace: {
                        extensionId: publication.extensionId,
                        version: publication.version,
                      },
                      asset,
                    },
                  ]),
              {
                recordId: publication.extensionId,
                expectedRevision,
                replace: { revision: publication.revision, enabled: publication.enabled },
                deleted: false,
              },
              ...(replacement
                ? [
                    {
                      recordId: replacement.extensionId,
                      expectedRevision: replacement.expectedRevision,
                      deleted: true,
                    },
                  ]
                : []),
            ],
          });
        },
        replacement ? [replacement.extensionId] : [],
      );
    },
  };
};
