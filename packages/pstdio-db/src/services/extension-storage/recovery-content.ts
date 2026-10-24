import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { and, asc, eq, like } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import {
  extension_instances,
  installed_extension_sources,
  recovery_point_owners,
  storage_document_updates,
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

// Compression runs off the main thread, so a large capture does not block other requests.
const compress = promisify(gzip);
const decompress = promisify(gunzip);
const encodeRecovery = async (value: RecoveryRecord[] | RecoveryMetadata) =>
  new Uint8Array(await compress(JSON.stringify(value)));
export const decodeRecovery = async <T extends RecoveryRecord[] | RecoveryMetadata>(bytes: Uint8Array) =>
  JSON.parse((await decompress(bytes)).toString()) as T;

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

// A read-only load of one saved document, so it can join the capture transaction.
const readDocument = async (tx: Transaction, owner: StorageOwner, documentId: string) => {
  const document = new Y.Doc();
  const where = <T extends typeof storage_documents | typeof storage_document_updates>(table: T) =>
    and(
      eq(table.workbench_id, owner.workbenchId),
      eq(table.extension_id, owner.extensionId),
      eq(table.document_id, documentId),
    );
  const [saved] = await tx
    .select({ state: storage_documents.state })
    .from(storage_documents)
    .where(where(storage_documents));
  if (saved) Y.applyUpdate(document, saved.state);
  const updates = await tx
    .select({ update: storage_document_updates.update })
    .from(storage_document_updates)
    .where(where(storage_document_updates))
    .orderBy(asc(storage_document_updates.revision));
  for (const { update } of updates) Y.applyUpdate(document, update);
  return document;
};

const readMetadata = async (tx: Transaction, owner: StorageOwner) => {
  const texts: Record<string, string> = {};
  for (const fileId of await textFileIds(tx, owner)) {
    const document = await readDocument(tx, owner, JSON.stringify(["text-file", fileId]));
    texts[fileId] = document.getText("content").toString();
    document.destroy();
  }
  const document = await readDocument(tx, owner, "records");
  const dataVersions = [...document.getMap("data-migrations").keys()].sort();
  document.destroy();
  return { texts, dataVersions };
};

/**
 * Reads the whole project in one transaction: every owner's live records at one owner revision,
 * its text documents and its migration markers. Locking the revision rows keeps commits out until
 * the transaction ends. An owner whose revision did not change reuses its saved records.
 */
export const readProjectContent = async (tx: Transaction, projectId: string) => {
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
  for (const extensionId of await dataOwners(tx, projectId)) {
    const owner = { workbenchId: projectId, extensionId };
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
      (await encodeRecovery(
        (
          await listProjectedRecords(tx, owner)
        ).map(({ recordId, value, asset, shared }) => ({
          recordId,
          value,
          asset,
          shared,
        })),
      ));
    const metadata = await readMetadata(tx, owner);
    const hasText = Object.values(metadata.texts).some((text) => text.length > 0);
    content.push({
      extensionId,
      revision,
      records,
      metadata: await encodeRecovery(metadata),
      hasData: hasText || (revisions.get(extensionId)?.live ?? 0) > 0,
    });
  }
  return content;
};
