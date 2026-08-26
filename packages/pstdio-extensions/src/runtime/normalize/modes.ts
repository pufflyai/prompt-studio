import type { ModeContribution } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { isLocalizableString } from "./localizable";
import { normalizeContributionRef } from "./references";

export const registerModes = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const modes = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "mode",
    contributions: contributionArray<ModeContribution>(source.definition.modes),
  });
  for (const mode of modes) {
    const localId = mode.id;
    if (!isRecord(mode) || !isLocalizableString(mode.label)) continue;
    runtime.modes.push({
      ...contributionRecordBase(ext, source, "mode", localId),
      contribution: {
        ...mode,
        ref: normalizeContributionRef(ext, mode.ref),
      } as ModeContribution,
    });
  }
};
