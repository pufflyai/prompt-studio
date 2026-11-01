interface DocumentStatus {
  downloaded: boolean;
  pending: boolean;
  needsAttention: boolean;
}

/** A stream is one sync document, regardless of its number of records or transport retries. */
export const documentProgress = (statuses: (DocumentStatus | undefined)[], directoryKnown: boolean) => ({
  downloaded: directoryKnown && statuses.every((status) => status?.downloaded),
  pending: statuses.some((status) => status?.pending),
  pendingItems:
    directoryKnown && statuses.every(Boolean) ? statuses.filter((status) => status?.pending).length : undefined,
  needsAttention: statuses.some((status) => status?.needsAttention),
  download: {
    completed: statuses.filter((status) => status?.downloaded).length,
    total: directoryKnown ? statuses.length : null,
  },
});

export const sumDocumentProgress = (
  owners: { pendingItems?: number; download?: { completed: number; total: number | null } }[],
) => ({
  pendingItems: owners.every((owner) => owner.pendingItems !== undefined)
    ? owners.reduce((sum, owner) => sum + (owner.pendingItems ?? 0), 0)
    : undefined,
  download: {
    completed: owners.reduce((sum, owner) => sum + (owner.download?.completed ?? 0), 0),
    total: owners.every((owner) => owner.download?.total != null)
      ? owners.reduce((sum, owner) => sum + (owner.download?.total ?? 0), 0)
      : null,
  },
});
