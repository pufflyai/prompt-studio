import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";
import { and, asc, eq, like } from "drizzle-orm";
import type { StorageOwner } from "pstdio-sync";
import * as Y from "yjs";
import type { DbClient } from "../../db/connection.pglite";
import { owners as storageOwners } from "../../db/schemas/owners";
import {
  installed_extension_sources,
  project_extensions,
  owners as recordOwners,
  recovery_point_owners,
  storage_document_updates,
  storage_documents,
} from "../../db/schemas.pg";
import { listProjectedRecords } from "./record-queries";
import type { RecoveryRecord } from "./recovery-edits";
import { type PreparedRecoveryBytes, prepareRecoveryBytes, type recoveryFilesFor } from "./recovery-files";
import { storageOwnerKey } from "./storage-owner-key";

type Reader = Pick<DbClient, "select" | "selectDistinct">;
type Transaction = Parameters<Parameters<DbClient["transaction"]>[0]>[0];

export interface RecoveryMetadata {
  texts: Record<string, string>;
  dataVersions: string[];
}
export interface RecoveryOwnerContent {
  extensionId: string;
  revision: number;
  file: PreparedRecoveryBytes;
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
          eq(storage_documents.owner_id, storageOwnerKey(owner)),
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
      .from(project_extensions)
      .innerJoin(installed_extension_sources, eq(project_extensions.extension_ref, installed_extension_sources.id))
      .innerJoin(
        storageOwners,
        and(
          eq(storageOwners.project_id, projectId),
          eq(storageOwners.extension_id, installed_extension_sources.extension_id),
        ),
      )
      .innerJoin(storage_documents, eq(storage_documents.owner_id, storageOwners.id))
      .where(eq(project_extensions.project_id, projectId))
  )
    .map((row) => row.id)
    .sort();

// A read-only load of one saved document, so it can join the capture transaction.
const readDocument = async (tx: Transaction, owner: StorageOwner, documentId: string) => {
  const document = new Y.Doc();
  const where = <T extends typeof storage_documents | typeof storage_document_updates>(table: T) =>
    and(eq(table.owner_id, storageOwnerKey(owner)), eq(table.document_id, documentId));
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
export const readProjectContent = async (
  tx: Transaction,
  projectId: string,
  files: ReturnType<typeof recoveryFilesFor>,
) => {
  const revisions = new Map(
    (
      await tx
        .select({
          id: storageOwners.extension_id,
          revision: recordOwners.revision,
          live: recordOwners.live_count,
        })
        .from(recordOwners)
        .where(eq(storageOwners.project_id, projectId))
        .for("share")
    ).map((row) => [row.id, row]),
  );
  const content: RecoveryOwnerContent[] = [];
  for (const extensionId of await dataOwners(tx, projectId)) {
    const owner = { workbenchId: projectId, extensionId };
    const revision = revisions.get(extensionId)?.revision ?? 0;
    const [previous] = await tx
      .select({
        hours: recovery_point_owners.hours,
        sha256: recovery_point_owners.sha256,
        bytes: recovery_point_owners.bytes,
      })
      .from(recovery_point_owners)
      .where(
        and(eq(recovery_point_owners.owner_id, storageOwnerKey(owner)), eq(recovery_point_owners.revision, revision)),
      )
      .limit(1);
    // A prior copy only saves encoding work. Its loss must not prevent saving
    // the authoritative live records, including an unselected owner during restore.
    const reusable = previous && (await files.read(projectId, previous.hours, previous).catch(() => undefined));
    const records =
      reusable?.records ??
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
      file: await prepareRecoveryBytes({ records, metadata: await encodeRecovery(metadata) }),
      hasData: hasText || (revisions.get(extensionId)?.live ?? 0) > 0,
    });
  }
  return content;
};
