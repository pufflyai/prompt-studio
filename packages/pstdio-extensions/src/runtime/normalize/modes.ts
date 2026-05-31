import type { ModeContribution } from "@pstdio/sdk/extensions";
import type { NormalizedExtension } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

export const registerModes = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [localId, mode] of Object.entries(source.definition.modes ?? {})) {
    if (!isRecord(mode) || typeof mode.label !== "string") continue;
    runtime.modes.push({
      id: contributionId(ext, localId),
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: mode as ModeContribution,
    });
  }
};
