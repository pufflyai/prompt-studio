export interface StorageRows {
  states: {
    documentId: string;
    stateId: string;
    byteLength: number;
    blobIds: string[];
    replacedAt: string | null;
  }[];
  updates: { documentId: string; byteLength: number; coveredAt: string | null; blobIds?: string[] }[];
  blobs: { blobId: string; byteLength: number }[];
}

/** R23 applies to the record stream's envelope and encrypted chunks together (ADR 0102). */
export const measureDocument = (rows: StorageRows, documentId: string, chunks: Set<string>) => {
  const states = rows.states.filter((row) => row.documentId === documentId);
  const updates = rows.updates.filter((row) => row.documentId === documentId);
  const blobs = rows.blobs.filter((row) => chunks.has(row.blobId));
  const sizes = new Map(blobs.map((row) => [row.blobId, Number(row.byteLength)]));
  const stateBytes = (state: (typeof states)[number]) =>
    Number(state.byteLength) + [...new Set(state.blobIds)].reduce((sum, id) => sum + (sizes.get(id) ?? 0), 0);
  const latest = states.find((row) => row.replacedAt === null);
  const latestBytes = latest ? stateBytes(latest) : 0;
  const covered = [
    ...states.filter((row) => row.replacedAt !== null),
    ...updates.filter((row) => row.coveredAt !== null),
  ];
  const graceIds = new Set(covered.flatMap((row) => row.blobIds ?? []));
  const graceBytes =
    covered.reduce((sum, row) => sum + Number(row.byteLength), 0) +
    blobs.filter((row) => graceIds.has(row.blobId)).reduce((sum, row) => sum + Number(row.byteLength), 0);
  const storedBytes = [...states, ...updates, ...blobs].reduce((sum, row) => sum + Number(row.byteLength), 0);
  const limitBytes = 2 * latestBytes + graceBytes;
  return {
    latestBytes,
    graceBytes,
    storedBytes,
    limitBytes,
    passed: latestBytes > 0 && storedBytes < limitBytes,
    stateRows: states.length,
    updateRows: updates.length,
    chunkObjects: blobs.length,
  };
};
