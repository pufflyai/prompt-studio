import { rm } from "node:fs/promises";
import { artifactFileProjectionSchema } from "pstdio-api-contracts";
import type { createExtensionStorageDBService } from "pstdio-db";
import type { StorageOwner } from "pstdio-sync";
import { apiLogger } from "../../lib/logger";
import { artifactProjectionKey, projectionAddress } from "./file-state";

const failureText = (error: unknown) => {
  const seen = new Set<unknown>();
  while (error instanceof Error && error.cause instanceof Error && !seen.has(error)) {
    seen.add(error);
    error = error.cause;
  }
  return (error instanceof Error ? `${error.name}: ${error.message}` : String(error)).slice(0, 4096);
};

/** A request never retries this upgrade. Its original JSON stays intact on failure. */
export const upgradeArtifactFileProjections = async (input: {
  projections: ReturnType<typeof createExtensionStorageDBService>["fileProjections"];
  contexts: { owner: StorageOwner; repoRoot: string }[];
  failed?: (error: unknown, key: string) => void;
}) => {
  const visited = new Set<string>();
  for (const { owner, repoRoot } of input.contexts) {
    const address = projectionAddress(artifactProjectionKey(owner, repoRoot));
    if (visited.has(address.key)) continue;
    visited.add(address.key);
    try {
      const source = Bun.file(address.path);
      if (!(await source.exists())) continue;
      const indexed = input.projections.open(address.key);
      if (!(await indexed.read([])).initialized) {
        const state = artifactFileProjectionSchema.parse(await source.json());
        await indexed.initialize(state);
      }
      await rm(address.path);
    } catch (error) {
      if (input.failed) input.failed(error, address.key);
      else
        apiLogger.error(
          { event: "artifact-files.upgrade.failed", projectionKey: address.key, error: failureText(error) },
          "Kept the original file projection state. Repair it before restarting Prompt Studio.",
        );
    }
  }
};
