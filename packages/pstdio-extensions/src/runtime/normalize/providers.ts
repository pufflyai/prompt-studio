import type { HarnessProvider, WorkspaceTypeProvider } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimeHarnessRecord, RuntimeWorkspaceTypeRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { isLocalizableString } from "./localizable";

const isValidSelectDescriptor = (descriptor: Record<string, unknown>) => {
  if (!Array.isArray(descriptor.options)) return false;
  if (descriptor.options.length === 0) return false;

  const values = new Set<string>();
  for (const option of descriptor.options) {
    if (!isRecord(option) || typeof option.label !== "string" || typeof option.value !== "string") return false;
    values.add(option.value);
  }

  if (descriptor.defaultValue === undefined) return true;
  return typeof descriptor.defaultValue === "string" && values.has(descriptor.defaultValue);
};

const isValidBooleanDescriptor = (descriptor: Record<string, unknown>) =>
  descriptor.defaultValue === undefined || typeof descriptor.defaultValue === "boolean";

const isValidHarnessParamDescriptor = (descriptor: Record<string, unknown>) => {
  if (descriptor.type === "select" && isValidSelectDescriptor(descriptor)) return true;
  if (descriptor.type === "boolean" && isValidBooleanDescriptor(descriptor)) return true;
  return false;
};

const normalizeHarnessParams = (schema: unknown) => {
  if (schema === undefined) return { params: undefined, invalidParams: [] };
  if (!isRecord(schema)) return { params: undefined, invalidParams: ["params"] };

  const params: Record<string, unknown> = {};
  const invalidParams: string[] = [];

  for (const [key, descriptor] of Object.entries(schema)) {
    if (isRecord(descriptor) && isValidHarnessParamDescriptor(descriptor)) {
      params[key] = descriptor;
      continue;
    }
    invalidParams.push(key);
  }

  return { params, invalidParams };
};

export const registerProviders = (ext: NormalizedExtension, source: LoadedExtensionSource, runtime: Accumulator) => {
  const harnesses = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "harness",
    contributions: contributionArray<HarnessProvider>(source.definition.harnesses),
  });
  for (const provider of harnesses) {
    if (!isRecord(provider) || typeof provider.id !== "string" || !isLocalizableString(provider.label)) continue;
    if (
      typeof provider.start !== "function" ||
      typeof provider.resume !== "function" ||
      typeof provider.capabilities !== "function"
    ) {
      continue;
    }
    const normalizedParams = normalizeHarnessParams(provider.params);
    for (const invalidParam of normalizedParams.invalidParams) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_harness_params",
          message: `Harness "${provider.id}" params only select and boolean descriptors are supported.`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { harnessId: provider.id, param: invalidParam },
        }),
      );
    }
    const normalizedProvider = { ...provider, params: normalizedParams.params };
    const record: RuntimeHarnessRecord = {
      ...contributionRecordBase(ext, source, "harness", provider.id),
      provider: normalizedProvider as RuntimeHarnessRecord["provider"],
    };
    runtime.harnesses.push(record);
  }

  const workspaceTypes = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "workspace-type",
    contributions: contributionArray<WorkspaceTypeProvider>(source.definition.workspaceTypes),
  });
  for (const provider of workspaceTypes) {
    if (!isRecord(provider) || typeof provider.id !== "string" || !isLocalizableString(provider.label)) continue;
    if (typeof provider.create !== "function" || typeof provider.resolve !== "function") continue;
    const record: RuntimeWorkspaceTypeRecord = {
      ...contributionRecordBase(ext, source, "workspace-type", provider.id),
      provider: provider as RuntimeWorkspaceTypeRecord["provider"],
    };
    runtime.workspaceTypes.push(record);
  }
};
