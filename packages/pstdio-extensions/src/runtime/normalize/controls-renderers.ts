import type { NormalizedExtension, RuntimeControlsRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { isLocalizableString } from "./localizable";
import { registerPrivateHandler } from "./private-handlers";
import { contributionId } from "./references";

const isValidControlsRenderer = (contribution: unknown) => {
  if (!isRecord(contribution) || !isLocalizableString(contribution.title)) return false;
  return typeof contribution.query === "function";
};

export const registerControlsRenderers = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.controlsRenderers ?? {})) {
    const id = contributionId(ext, localId);

    if (!isValidControlsRenderer(contribution)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_controls_renderer",
          message: `Controls renderer "${id}" must define title and query`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

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

    const queryHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "controls",
      rendererLocalId: localId,
      operation: "query",
      handler: contribution.query,
    });
    if (!queryHandlerId) continue;
    const valueChangeHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "controls",
      rendererLocalId: localId,
      operation: "onValueChange",
      handler: contribution.onValueChange,
    });
    const applyHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "controls",
      rendererLocalId: localId,
      operation: "onApply",
      handler: contribution.onApply,
    });
    const resetHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "controls",
      rendererLocalId: localId,
      operation: "onReset",
      handler: contribution.onReset,
    });

    const record: RuntimeControlsRendererRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: {
        ...contribution,
        queryHandlerId,
        valueChangeHandlerId,
        applyHandlerId,
        resetHandlerId,
      } as RuntimeControlsRendererRecord["contribution"],
    };

    index.controlsRendererIds.set(id, record);
    runtime.controlsRenderers.push(record);
  }
};
