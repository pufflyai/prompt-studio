import { createProcessOwner, type ProcessOwner } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { type ProcessEnvironmentSource, processEnvironmentSourceIdentity as sourceIdentity } from "./process-environment/permissions";

type Generation = { projectId: string; extensionId: string; identity: string; owner: ProcessOwner };

/**
 * Owns children started with `lifetime: "extension"` by commands, hooks and schedules. One owner
 * exists per project and enabled source generation. It closes when the extension is disabled or
 * removed, its source content changes, the project goes away, or the host shuts down. A catalog
 * rebuild that leaves the source unchanged, such as finished webviews, keeps it.
 */
export const createExtensionProcessOwners = (input: {
  /** The enabled source this project runs for the extension, or undefined when none is. */
  findEnabledSource: (projectId: string, extensionId: string) => Promise<ProcessEnvironmentSource | undefined>;
}) => {
  const generations = new Map<string, Generation>();
  let disposed = false;

  const retire = (key: string, generation: Generation) => {
    if (generations.get(key) === generation) generations.delete(key);
    return generation.owner.close();
  };

  const stillCurrent = async (generation: Generation) => {
    try {
      const source = await input.findEnabledSource(generation.projectId, generation.extensionId);
      return source !== undefined && sourceIdentity(source) === generation.identity;
    } catch (error) {
      // A source that cannot be read now may be read later; stopping its children here is not recoverable.
      apiLogger.warn(
        { err: error, event: "extension.process_owner.check_failed", extension_id: generation.extensionId },
        "Could not check whether extension processes still belong to an enabled source",
      );
      return true;
    }
  };

  return {
    owner(projectId: string, source: ProcessEnvironmentSource): ProcessOwner {
      const identity = sourceIdentity(source);
      const key = JSON.stringify([projectId, source.extension_id, identity]);
      let generation = generations.get(key);
      if (!generation) {
        generation = { projectId, extensionId: source.extension_id, identity, owner: createProcessOwner() };
        if (disposed) void generation.owner.close();
        else generations.set(key, generation);
      }
      return generation.owner;
    },

    /** Stops the children of generations that are no longer the enabled source. Omit projectId to check all. */
    async reconcile(projectId?: string) {
      const checks = [...generations].filter(([, generation]) => !projectId || generation.projectId === projectId);
      await Promise.all(
        checks.map(async ([key, generation]) => {
          if (!(await stillCurrent(generation))) await retire(key, generation);
        }),
      );
    },

    async dispose() {
      disposed = true;
      await Promise.all([...generations].map(([key, generation]) => retire(key, generation)));
    },
  };
};

export type ExtensionProcessOwners = ReturnType<typeof createExtensionProcessOwners>;
