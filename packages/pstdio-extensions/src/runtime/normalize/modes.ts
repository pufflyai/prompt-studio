import type { ModeContribution } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import type { Accumulator } from "./accumulator";
import { modeDeclarationSchema } from "./composition-declarations";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { validateDeclaration } from "./declaration-diagnostic";
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
    if (!validateDeclaration({ ext, source, runtime, kind: "mode", contribution: mode, schema: modeDeclarationSchema }))
      continue;
    runtime.modes.push({
      ...contributionRecordBase(ext, source, "mode", localId),
      contribution: {
        ...mode,
        ref: normalizeContributionRef(ext, mode.ref),
        ...(mode.defaultTheme ? { defaultTheme: normalizeContributionRef(ext, mode.defaultTheme) } : {}),
        ...(mode.chrome
          ? {
              chrome: Object.fromEntries(
                Object.entries(mode.chrome).map(([region, view]) => [
                  region,
                  view === false ? false : normalizeContributionRef(ext, view),
                ]),
              ),
            }
          : {}),
      } as ModeContribution,
    });
  }
};
