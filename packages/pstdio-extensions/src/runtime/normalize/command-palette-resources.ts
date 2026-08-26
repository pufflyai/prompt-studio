import type { CommandPaletteResourceContribution } from "@pstdio/sdk/extensions";
import type { NormalizedExtension, RuntimeCommandPaletteResourceRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { contributionArray, contributionRecordBase, uniqueContributions } from "./contribution-collection";
import { isLocalizableString } from "./localizable";
import { registerPrivateHandler } from "./private-handlers";
import { normalizeContributionRef } from "./references";

export const registerCommandPaletteResources = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  const contributions = uniqueContributions({
    ext,
    source,
    runtime,
    kind: "command-palette-resource",
    contributions: contributionArray<CommandPaletteResourceContribution>(source.definition.commandPaletteResources),
  });
  for (const contribution of contributions) {
    const localId = contribution.id;
    const base = contributionRecordBase(ext, source, "command-palette-resource", localId);
    const id = base.id;

    if (
      !isRecord(contribution) ||
      !isLocalizableString(contribution.title) ||
      typeof contribution.query !== "function"
    ) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_command_palette_resource",
          message: `Command palette resource "${id}" must define title and query`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    const queryHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "commandPaletteResource",
      rendererLocalId: localId,
      operation: "query",
      handler: contribution.query,
    });
    if (!queryHandlerId) continue;

    const record: RuntimeCommandPaletteResourceRecord = {
      ...base,
      contribution: {
        ...contribution,
        ref: normalizeContributionRef(ext, contribution.ref),
        queryHandlerId,
        ...(contribution.resourceKind
          ? { resourceKind: normalizeContributionRef(ext, contribution.resourceKind) }
          : {}),
      } as RuntimeCommandPaletteResourceRecord["contribution"],
    };

    const existing = index.commandPaletteResourceIds.get(id);
    if (existing) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "duplicate_command_palette_resource_id",
          message: `Command palette resource id "${id}" is already provided by ${existing.sourcePath}`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

    index.commandPaletteResourceIds.set(id, record);
    runtime.commandPaletteResources.push(record);
  }
};
