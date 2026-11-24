import { createProcessOwner, type ProcessOwner } from "pstdio-extensions";
import { apiLogger } from "../../lib/logger";
import { type ProcessEnvironmentSource, processEnvironmentSourceIdentity as sourceIdentity } from "./process-environment/permissions";

type Generation = { projectId: string; extensionId: string; instanceId: string; identity: string; owner: ProcessOwner };

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
  const retiring = new Set<Generation>();
  let disposed = false;

  const stop = async (generation: Generation) => {
    try {
      await generation.owner.close();
      retiring.delete(generation);
    } catch (error) {
      apiLogger.warn(
        {
          err: error,
          event: "extension.process_owner.stop_failed",
          extension_id: generation.extensionId,
          project_id: generation.projectId,
        },
        "Could not stop owned extension processes",
      );
    }
  };

  const retire = (key: string, generation: Generation) => {
    if (generations.get(key) === generation) generations.delete(key);
    retiring.add(generation);
    return stop(generation);
  };

  const stillCurrent = async (generation: Generation, firstCheck: boolean) => {
    try {
      const source = await input.findEnabledSource(generation.projectId, generation.extensionId);
      return source !== undefined && sourceIdentity(source) === generation.identity;
    } catch (error) {
      // A source that cannot be read now may be read later; stopping its children here is not recoverable.
      apiLogger.warn(
        { err: error, event: "extension.process_owner.check_failed", extension_id: generation.extensionId },
        "Could not check whether extension processes still belong to an enabled source",
      );
      return !firstCheck;
    }
  };

  const verify = (key: string, generation: Generation, firstCheck = false) => {
    const ready = stillCurrent(generation, firstCheck).then(async (current) => {
      if (!current) await retire(key, generation);
    });
    generation.owner.ready = ready;
    return ready;
  };

  return {
    capture(projectId: string, instanceId: string, source: ProcessEnvironmentSource) {
      const identity = sourceIdentity(source);
      const key = JSON.stringify([projectId, instanceId, identity]);
      let generation = generations.get(key);
      if (!generation) {
        generation = { projectId, extensionId: source.extension_id, instanceId, identity, owner: createProcessOwner() };
        if (disposed) void generation.owner.close();
        else generations.set(key, generation);
      }
      const captured = generation;
      return () => {
        // A command keeps its generation even if the same source is later re-enabled.
        if (!captured.owner.closed && !captured.owner.ready) void verify(key, captured, true);
        return captured.owner;
      };
    },

    retireInstance(instanceId: string) {
      return Promise.all(
        [...generations]
          .filter(([, generation]) => generation.instanceId === instanceId)
          .map(([key, generation]) => retire(key, generation)),
      );
    },

    /** Stops the children of generations that are no longer the enabled source. Omit projectId to check all. */
    async reconcile(projectId?: string) {
      const checks = [...generations].filter(([, generation]) => !projectId || generation.projectId === projectId);
      await Promise.all(checks.map(([key, generation]) => verify(key, generation)));
    },

    async dispose() {
      disposed = true;
      const pending = [...retiring].map(stop);
      await Promise.all([...pending, ...[...generations].map(([key, generation]) => retire(key, generation))]);
    },
  };
};

export type ExtensionProcessOwners = ReturnType<typeof createExtensionProcessOwners>;
