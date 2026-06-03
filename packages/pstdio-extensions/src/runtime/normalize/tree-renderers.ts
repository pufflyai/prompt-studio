import type { NormalizedExtension, RuntimeTreeRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex, refId } from "./accumulator";
import { isLocalizableString } from "./localizable";

const contributionId = (ext: NormalizedExtension, localId: string) => `${ext.name}.${localId}`;

const isLocalCommandRef = (ext: NormalizedExtension, commandId: string) => commandId.startsWith(`${ext.name}.`);

const treeCommandId = (value: unknown) => refId(value as Parameters<typeof refId>[0]);

const hasKnownLocalCommand = (ext: NormalizedExtension, commandId: string | null, index: RegistryIndex) => {
  if (!commandId) return false;
  if (!isLocalCommandRef(ext, commandId)) return true;
  return index.commandIds.has(commandId);
};

const isValidTreeRenderer = (ext: NormalizedExtension, contribution: unknown, index: RegistryIndex) => {
  if (!isRecord(contribution) || !isLocalizableString(contribution.title)) return false;
  if (!hasKnownLocalCommand(ext, treeCommandId(contribution.bodyCommand), index)) return false;
  if (contribution.childrenCommand && !hasKnownLocalCommand(ext, treeCommandId(contribution.childrenCommand), index)) {
    return false;
  }
  if (contribution.footerCommand && !hasKnownLocalCommand(ext, treeCommandId(contribution.footerCommand), index)) {
    return false;
  }
  return true;
};

export const registerTreeRenderers = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.treeRenderers ?? {})) {
    const id = contributionId(ext, localId);

    if (!isValidTreeRenderer(ext, contribution, index)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_tree_renderer",
          message: `Tree renderer "${id}" must define title and a valid bodyCommand`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const record: RuntimeTreeRendererRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: contribution as RuntimeTreeRendererRecord["contribution"],
    };

    const existing = index.treeRendererIds.get(id);
    if (existing) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_tree_renderer_id",
          message: `Tree renderer id "${id}" is already provided by ${existing.sourcePath}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    index.treeRendererIds.set(id, record);
    runtime.treeRenderers.push(record);
  }
};
