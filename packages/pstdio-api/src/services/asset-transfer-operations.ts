import type { AssetOwner } from "pstdio-api-contracts";
import { AssetTransferError } from "./asset-transfer-errors";

interface OperationQueue {
  tail: Promise<void>;
  controllers: Set<AbortController>;
}

export const createAssetTransferOperations = () => {
  const queues = new Map<string, OperationQueue>();
  const queueFor = (owner: AssetOwner, operationId: string) => {
    const key = JSON.stringify([owner.workbenchId, owner.extensionId, operationId]);
    let queue = queues.get(key);
    if (!queue) {
      queue = { tail: Promise.resolve(), controllers: new Set() };
      queues.set(key, queue);
    }
    return { key, queue };
  };
  const enqueue = <T>(key: string, queue: OperationQueue, action: () => Promise<T>) => {
    const result = queue.tail.then(action);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    queue.tail = tail;
    return result.finally(() => {
      if (queues.get(key) === queue && queue.tail === tail) queues.delete(key);
    });
  };
  const run = <T>(
    owner: AssetOwner,
    operationId: string,
    action: (signal: AbortSignal) => Promise<T>,
    requestSignal?: AbortSignal,
  ) => {
    const { key, queue } = queueFor(owner, operationId);
    const controller = new AbortController();
    queue.controllers.add(controller);
    const signal = requestSignal ? AbortSignal.any([requestSignal, controller.signal]) : controller.signal;
    return enqueue(key, queue, async () => {
      signal.throwIfAborted();
      return action(signal);
    }).finally(() => queue.controllers.delete(controller));
  };
  const interrupt = <T>(owner: AssetOwner, operationId: string, action: () => Promise<T>) => {
    const { key, queue } = queueFor(owner, operationId);
    for (const controller of queue.controllers) controller.abort(new AssetTransferError("ASSET_TRANSFER_CANCELLED"));
    return enqueue(key, queue, action);
  };
  return { run, interrupt };
};
