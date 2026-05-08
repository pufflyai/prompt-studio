import type { NormalizedExtension, RuntimeHarnessRecord, RuntimeWorkspaceTypeRecord } from "../../types/runtime";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";

export const registerProviders = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  for (const [, provider] of Object.entries(source.definition.harnesses ?? {})) {
    if (!isRecord(provider) || typeof provider.id !== "string" || typeof provider.label !== "string") continue;
    if (typeof provider.start !== "function") continue;
    const record: RuntimeHarnessRecord = {
      id: provider.id,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      provider: provider as RuntimeHarnessRecord["provider"],
    };
    runtime.harnesses.push(record);
  }

  for (const [, provider] of Object.entries(source.definition.workspaceTypes ?? {})) {
    if (!isRecord(provider) || typeof provider.id !== "string" || typeof provider.label !== "string") continue;
    if (typeof provider.create !== "function" || typeof provider.resolve !== "function") continue;
    const record: RuntimeWorkspaceTypeRecord = {
      id: provider.id,
      extensionId: ext.id,
      namespace: ext.namespace,
      sourcePath: source.sourcePath,
      provider: provider as RuntimeWorkspaceTypeRecord["provider"],
    };
    runtime.workspaceTypes.push(record);
  }
};
