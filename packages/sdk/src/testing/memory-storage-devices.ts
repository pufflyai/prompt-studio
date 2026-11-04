import type { ExtensionStorageApi, JsonValue } from "pstdio-api-contracts/extension-kernel";
import { findDocumentReplacements } from "pstdio-sync/records";
import { createMemoryStorageDevice, type MemoryStorageOptions } from "./memory-storage";
import { admitMemoryOperations } from "./ordered-memory-records";

export interface MemoryStorageReplacement {
  recordId: string;
  /** Starts with value, asset or shared. Arrays and strings are reported as whole values. */
  path: (string | number)[];
  /** Undefined means the value was removed. */
  kept: JsonValue | undefined;
  /** Undefined means a concurrent removal was replaced. */
  replaced: JsonValue | undefined;
}

/** Two offline devices for one extension. Finish writes before calling merge. */
export const createMemoryStorageDevices = async (options: MemoryStorageOptions = {}) => {
  const first = createMemoryStorageDevice(options);
  const second = createMemoryStorageDevice({
    legacyData: options.legacyData,
    indexes: options.indexes,
    textFields: options.textFields,
    logs: options.logs,
    workbenchId: first.workbenchId,
    extensionId: options.extensionId,
  });
  await second.applyUpdate(await first.exportUpdate());
  await second.installOrdered(await first.exportOrdered());
  const epoch = crypto.randomUUID();
  const devices: [ExtensionStorageApi, ExtensionStorageApi] = [first.storage, second.storage];
  let base = await first.snapshot();
  return {
    devices,
    async merge() {
      const left = await first.snapshot();
      const right = await second.snapshot();
      const firstUpdate = await first.exportUpdate();
      const secondUpdate = await second.exportUpdate();
      // Capture both updates before applying either, so each device receives the opposite order.
      await first.applyUpdate(secondUpdate);
      await second.applyUpdate(firstUpdate);
      const state = await first.exportOrdered();
      for (const [id, identity] of (await second.exportOrdered()).identities) {
        const previous = state.identities.get(id);
        if (previous !== undefined && previous !== identity)
          throw new Error("Operation identity reused with changed payload");
        state.identities.set(id, identity);
      }
      await admitMemoryOperations(
        state,
        [...(await first.pendingOrdered()), ...(await second.pendingOrdered())],
        epoch,
      );
      await first.installOrdered(state);
      await second.installOrdered(state);
      await first.logs.merge(second.logs);
      const merged = await first.snapshot();
      const replacements: MemoryStorageReplacement[] = findDocumentReplacements(base, left, right, merged, {
        wholeArrays: true,
      });
      base = merged;
      return replacements;
    },
  };
};
