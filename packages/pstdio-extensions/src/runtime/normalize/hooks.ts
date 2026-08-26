import type { HookDefinition } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimeHookRecord } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { resolveEventRef } from "./references";

export const registerHooks = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "hook",
    contributions: contributionArray<HookDefinition>(source.definition.hooks),
  });
  for (const hook of contributions) {
    const localId = hook.id;
    if (typeof hook.run !== "function") continue;
    const eventId = resolveEventRef(ext, hook.event);

    const record: RuntimeHookRecord = {
      ...contributionRecordBase(ext, source, "hook", localId),
      eventId,
      handler: hook.run as RuntimeHookRecord["handler"],
    };
    runtime.hooks.push(record);
  }
};
