import type { OwnerInput } from "./device";
import type { inspectStorage } from "./inspect";
import { measureDocument, type StorageRows } from "./measurements";

export const reconcileObjects = (
  expected: { key: string; bytes: number }[],
  physical: { key: string; bytes: number }[],
) => {
  const wanted = new Map(expected.map((object) => [object.key, object.bytes]));
  const present = new Map(physical.map((object) => [object.key, object.bytes]));
  const unknown = physical.filter((object) => !wanted.has(object.key));
  const missing = expected.filter((object) => !present.has(object.key));
  const mismatched = physical.filter((object) => wanted.has(object.key) && wanted.get(object.key) !== object.bytes);
  return {
    unknown,
    missing,
    mismatched,
    passed: unknown.length === 0 && missing.length === 0 && mismatched.length === 0,
  };
};

export const measureFiles = (rows: StorageRows, documentId: string, files: Set<string>) => {
  const states = rows.states.filter((row) => row.documentId === documentId);
  const updates = rows.updates.filter((row) => row.documentId === documentId);
  const latest = new Set(
    [...states.filter((row) => row.replacedAt === null), ...updates.filter((row) => row.coveredAt === null)]
      .flatMap((row) => row.blobIds ?? [])
      .filter((id) => files.has(id)),
  );
  const grace = new Set(
    [...states.filter((row) => row.replacedAt !== null), ...updates.filter((row) => row.coveredAt !== null)]
      .flatMap((row) => row.blobIds ?? [])
      .filter((id) => files.has(id) && !latest.has(id)),
  );
  const blobs = rows.blobs.filter((row) => files.has(row.blobId));
  const sum = (ids: Set<string>) =>
    blobs.filter((blob) => ids.has(blob.blobId)).reduce((total, blob) => total + blob.byteLength, 0);
  const latestBytes = sum(latest);
  const graceBytes = sum(grace);
  const storedBytes = blobs.reduce((total, blob) => total + blob.byteLength, 0);
  const limitBytes = 2 * latestBytes + graceBytes;
  return {
    latestBytes,
    graceBytes,
    storedBytes,
    limitBytes,
    objects: blobs.length,
    passed: storedBytes === 0 || storedBytes < limitBytes,
  };
};

export const auditStorage = (storage: Awaited<ReturnType<typeof inspectStorage>>, units: Map<string, OwnerInput>) => {
  const classified = new Set<string>();
  const documents = [...units].map(([documentId, unit]) => {
    const transport = new Set([...unit.chunks, ...unit.frames]);
    for (const id of [...transport, ...unit.files]) classified.add(id);
    return {
      documentId,
      records: measureDocument(storage.rows, documentId, transport),
      files: measureFiles(storage.rows, documentId, unit.files),
      chunkIds: [...unit.chunks],
      frameIds: [...unit.frames],
      fileIds: [...unit.files],
    };
  });
  const unknownBlobs = storage.rows.blobs.filter((blob) => !classified.has(blob.blobId));
  const physical = reconcileObjects(storage.expectedObjects, storage.objects);
  return {
    documents,
    unknownBlobs,
    physical,
    missingBlobMappings: storage.missingBlobMappings,
    unfinishedUploads: storage.unfinishedUploads,
    passed:
      physical.passed &&
      unknownBlobs.length === 0 &&
      storage.missingBlobMappings.length === 0 &&
      storage.unfinishedUploads.length === 0 &&
      documents.every((document) => document.records.passed && document.files.passed),
  };
};
