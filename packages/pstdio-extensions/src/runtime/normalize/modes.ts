import { dockedWorkbenchRegions, type ModeContribution } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
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
    const hasValidRegions =
      Array.isArray(mode.regions) &&
      mode.regions.every(
        (region) =>
          typeof region === "string" &&
          dockedWorkbenchRegions.includes(region as (typeof dockedWorkbenchRegions)[number]),
      );
    if (!isRecord(mode) || !isLocalizableString(mode.label) || !hasValidRegions) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_mode",
          message: `Mode "${localId}" must declare a label and valid workbench regions`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: localId, fieldPath: `modes.${localId}.regions` },
        }),
      );
      continue;
    }
    runtime.modes.push({
      ...contributionRecordBase(ext, source, "mode", localId),
      contribution: {
        ...mode,
        ref: normalizeContributionRef(ext, mode.ref),
      } as ModeContribution,
    });
  }
};
