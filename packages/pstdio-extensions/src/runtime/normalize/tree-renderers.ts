import type { NormalizedExtension, RuntimeTreeRendererRecord } from "../../types/runtime";
import { createDiagnostic } from "../diagnostics";
import type { LoadedExtensionSource } from "../loader";
import { type Accumulator, isRecord, type RegistryIndex } from "./accumulator";
import { isLocalizableString } from "./localizable";
import { registerPrivateHandler } from "./private-handlers";
import { contributionId } from "./references";

const isValidTreeRenderer = (contribution: unknown) => {
  if (!isRecord(contribution) || !isLocalizableString(contribution.title)) return false;
  return typeof contribution.body === "function";
};

export const registerTreeRenderers = (
  ext: NormalizedExtension,
  source: LoadedExtensionSource,
  runtime: Accumulator,
  index: RegistryIndex,
) => {
  for (const [localId, contribution] of Object.entries(source.definition.treeRenderers ?? {})) {
    const id = contributionId(ext, localId);

    if (!isValidTreeRenderer(contribution)) {
      runtime.diagnostics.push(
        createDiagnostic({
          code: "invalid_tree_renderer",
          message: `Tree renderer "${id}" must define title and body`,
          extensionId: ext.id,
          sourcePath: source.sourcePath,
          metadata: { contributionId: id },
        }),
      );
      continue;
    }

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

    const bodyHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "tree",
      rendererLocalId: localId,
      operation: "body",
      handler: contribution.body,
    });
    if (!bodyHandlerId) continue;
    const childrenHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "tree",
      rendererLocalId: localId,
      operation: "children",
      handler: contribution.children,
    });
    const footerHandlerId = registerPrivateHandler({
      ext,
      source,
      runtime,
      index,
      rendererId: id,
      rendererKind: "tree",
      rendererLocalId: localId,
      operation: "footer",
      handler: contribution.footer,
    });

    const record: RuntimeTreeRendererRecord = {
      id,
      localId,
      extensionId: ext.id,
      name: ext.name,
      sourcePath: source.sourcePath,
      contribution: {
        ...contribution,
        bodyHandlerId,
        childrenHandlerId,
        footerHandlerId,
      } as RuntimeTreeRendererRecord["contribution"],
    };

    index.treeRendererIds.set(id, record);
    runtime.treeRenderers.push(record);
  }
};
