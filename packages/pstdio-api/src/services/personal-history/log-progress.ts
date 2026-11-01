import { type documentProgress, sumDocumentProgress } from "../relay/document-progress";

/** Progress is metadata: status reads never open a transcript or enumerate saved pages. */
export const createLogProgress = () => {
  let known = false;
  let total = 0;
  let reading = new Set<string>();
  return {
    invalidate() {
      known = false;
    },
    receive(own: Set<string>, remote: string[], behind: Set<string>) {
      total = own.size + remote.length;
      reading = new Set(behind);
      known = true;
    },
    received(id: string) {
      reading.delete(id);
    },
    status(publishing: Set<string>) {
      return {
        downloaded: known && reading.size === 0,
        pending: publishing.size > 0,
        pendingItems: known ? publishing.size : undefined,
        needsAttention: false,
        download: { completed: total - reading.size, total: known ? total : null },
      };
    },
  };
};

export const personalHistoryProgress = (
  index: ReturnType<typeof documentProgress>,
  logs: ReturnType<ReturnType<typeof createLogProgress>["status"]>,
  firstDownloaded: boolean,
  connection: { connected: boolean; busy: boolean },
) => ({
  firstDownloaded,
  downloaded: index.downloaded && logs.downloaded,
  pending: index.pending || logs.pending,
  needsAttention: index.needsAttention,
  ...sumDocumentProgress([index, logs]),
  ...connection,
});
