import { isInitialCollectionsSyncComplete, subscribeCollections } from "./collections";

export const waitForInitialCollectionsSync = async (signal: AbortSignal) => {
  signal.throwIfAborted();
  if (isInitialCollectionsSyncComplete()) return;
  await new Promise<void>((resolve, reject) => {
    const dispose = () => {
      unsubscribe();
      signal.removeEventListener("abort", abort);
    };
    const abort = () => {
      dispose();
      reject(signal.reason);
    };
    const unsubscribe = subscribeCollections(() => {
      if (!isInitialCollectionsSyncComplete()) return;
      dispose();
      resolve();
    });
    signal.addEventListener("abort", abort, { once: true });
  });
};
