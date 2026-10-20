import type { ExtensionStorageApi, JsonValue } from "pstdio-api-contracts/extension-kernel";
import { findDocumentReplacements } from "pstdio-sync";
import { createMemoryStorageDevice, type MemoryStorageOptions } from "./memory-storage";

export interface MemoryStorageReplacement {
  recordId: string;
  /** Starts with value, asset or shared. List positions follow the merged list, then removed items. */
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
    workbenchId: first.workbenchId,
    extensionId: options.extensionId,
  });
  await second.applyUpdate(await first.exportUpdate());
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
      const merged = await first.snapshot();
      const replacements: MemoryStorageReplacement[] = findDocumentReplacements(base, left, right, merged);
      base = merged;
      return replacements;
    },
  };
};
