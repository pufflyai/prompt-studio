import { gunzipSync, gzipSync } from "node:zlib";
import { and, eq, like } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import type { DbClient } from "../../db/connection.pglite";
import {
  extension_instances,
  installed_extension_sources,
  recovery_point_owners,
  storage_documents,
  storage_record_projections,
} from "../../db/schemas.pg";
import { listProjectedRecords } from "./record-queries";
import type { RecoveryRecord } from "./recovery-edits";

type Reader = Pick<DbClient, "select" | "selectDistinct">;
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export interface RecoveryMetadata {
  texts: Record<string, string>;
  dataVersions: string[];
}
export interface RecoveryOwnerContent {
  extensionId: string;
  revision: number;
  records: Uint8Array;
  metadata: Uint8Array;
  /** The owner has live records or text. A project without any gets no recovery point. */
  hasData: boolean;
}

export const encodeRecovery = (value: RecoveryRecord[] | RecoveryMetadata) => gzipSync(JSON.stringify(value));
export const decodeRecovery = <T extends RecoveryRecord[] | RecoveryMetadata>(bytes: Uint8Array) =>
  JSON.parse(gunzipSync(bytes).toString()) as T;

const textPrefix = JSON.stringify(["text-file", ""]).slice(0, -3);

export const textFileIds = async (db: Reader, owner: StorageOwner) =>
  (
    await db
      .select({ id: storage_documents.document_id })
      .from(storage_documents)
      .where(
        and(
          eq(storage_documents.workbench_id, owner.workbenchId),
          eq(storage_documents.extension_id, owner.extensionId),
          like(storage_documents.document_id, `${textPrefix}%`),
        ),
      )
  )
    .map((row) => (JSON.parse(row.id) as [string, string])[1])
    .sort();

/** The project's extensions that saved data. Internal host owners have no extension instance and stay out. */
export const dataOwners = async (db: Reader, projectId: string) =>
  (
    await db
      .selectDistinct({ id: installed_extension_sources.extension_id })
      .from(extension_instances)
      .innerJoin(
        installed_extension_sources,
        eq(extension_instances.installed_extension_id, installed_extension_sources.id),
      )
      .innerJoin(
        storage_documents,
        and(
          eq(storage_documents.workbench_id, projectId),
          eq(storage_documents.extension_id, installed_extension_sources.extension_id),
        ),
      )
      .where(and(eq(extension_instances.scope_type, "project"), eq(extension_instances.scope_id, projectId)))
  )
    .map((row) => row.id)
    .sort();

/**
 * Reads every owner's live records at one owner revision. Locking the revision rows keeps commits
 * out until the transaction ends. An owner whose revision did not change reuses its saved records.
 */
export const readProjectRecords = async (
  tx: Transaction,
  projectId: string,
  metadata: Map<string, { bytes: Uint8Array; hasText: boolean }>,
) => {
  const revisions = new Map(
    (
      await tx
        .select({
          id: storage_record_projections.extension_id,
          revision: storage_record_projections.revision,
          live: storage_record_projections.live_count,
        })
        .from(storage_record_projections)
        .where(eq(storage_record_projections.workbench_id, projectId))
        .for("share")
    ).map((row) => [row.id, row]),
  );
  const content: RecoveryOwnerContent[] = [];
  for (const [extensionId, { bytes, hasText }] of metadata) {
    const revision = revisions.get(extensionId)?.revision ?? 0;
    const [previous] = await tx
      .select({ records: recovery_point_owners.records })
      .from(recovery_point_owners)
      .where(
        and(
          eq(recovery_point_owners.workbench_id, projectId),
          eq(recovery_point_owners.extension_id, extensionId),
          eq(recovery_point_owners.revision, revision),
        ),
      )
      .limit(1);
    const records =
      previous?.records ??
      encodeRecovery(
        (await listProjectedRecords(tx, { workbenchId: projectId, extensionId })).map(
          ({ recordId, value, asset, shared }) => ({ recordId, value, asset, shared }),
        ),
      );
    const hasData = hasText || (revisions.get(extensionId)?.live ?? 0) > 0;
    content.push({ extensionId, revision, records, metadata: bytes, hasData });
  }
  return content;
};
