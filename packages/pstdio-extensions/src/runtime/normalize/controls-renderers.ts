import type { NormalizedExtension, RuntimeControlsRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex, refId } from "./accumulator";
import { isLocalizableString } from "./localizable";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

const isLocalCommandRef = (ext: NormalizedExtension, commandId: string) => commandId.startsWith(`${ext.name}.`);

const commandRefId = (value: unknown) => refId(value as Parameters<typeof refId>[0]);

const hasKnownLocalCommand = (ext: NormalizedExtension, commandId: string | null, index: RegistryIndex) => {
  if (!commandId) return false;
  if (!isLocalCommandRef(ext, commandId)) return true;
  return index.commandIds.has(commandId);
};

const optionalCommandResolves = (ext: NormalizedExtension, value: unknown, index: RegistryIndex) => {
  if (value === undefined) return true;
  return hasKnownLocalCommand(ext, commandRefId(value), index);
};

const isValidControlsRenderer = (ext: NormalizedExtension, contribution: unknown, index: RegistryIndex) => {
  if (!isRecord(contribution) || !isLocalizableString(contribution.title)) return false;
  if (!hasKnownLocalCommand(ext, commandRefId(contribution.queryCommand), index)) return false;
  if (!optionalCommandResolves(ext, contribution.updateValueCommand, index)) return false;
  if (!optionalCommandResolves(ext, contribution.applyCommand, index)) return false;
  if (!optionalCommandResolves(ext, contribution.resetCommand, index)) return false;
  return true;
};

export const registerControlsRenderers = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.controlsRenderers ?? {})) {
    const id = contributionId(ext, localId);

    if (!isValidControlsRenderer(ext, contribution, index)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_controls_renderer",
          message: `Controls renderer "${id}" must define title and a valid queryCommand`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const record: RuntimeControlsRendererRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: contribution as RuntimeControlsRendererRecord["contribution"],
    };

    const existing = index.controlsRendererIds.get(id);
    if (existing) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_controls_renderer_id",
          message: `Controls renderer id "${id}" is already provided by ${existing.sourcePath}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    index.controlsRendererIds.set(id, record);
    runtime.controlsRenderers.push(record);
  }
};
