import { type NativeTextTarget, resolveFileRendererPresentation } from "pstdio-api-contracts";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { resolveNativeFilePresentation } from "./file-source";
import { resolveNativeSource } from "./source-binding";
import { NativeDocumentSourceError } from "./source-error";
import { type ProviderTarget, resolveTextProvider } from "./source-provider";

const resolveProviderAccess = async (deps: ExtensionsRouteDeps, input: ProviderTarget) => {
  const { resolved, owner } = await resolveTextProvider(deps, input);
  return {
    ...(await resolveNativeSource(deps, owner, resolved.source)),
    owner,
    content: { content: resolved.content, editable: resolved.editable, documentSource: resolved.source },
    projectionTarget: { extensionId: input.extensionId, textDocument: input.textDocument },
  };
};

/** Recheck domain access and identity without importing a physical byte observation into the text authority. */
export const resolveNativeTextAccess = async (
  deps: ExtensionsRouteDeps,
  input: NativeTextTarget & { projectId: string; signal?: AbortSignal },
) => {
  if ("textDocument" in input) return resolveProviderAccess(deps, input);
  const { view, save, content } = await resolveNativeFilePresentation(deps, input);
  if (content.textDocument) {
    if (content.documentSource)
      throw new NativeDocumentSourceError(
        400,
        "native_document_source_invalid",
        "A file view must declare only one text source",
      );
    const loaded = await resolveProviderAccess(deps, {
      projectId: input.projectId,
      signal: input.signal,
      extensionId: view.extensionId,
      textDocument: content.textDocument,
    });
    return {
      ...loaded,
      content: {
        ...content,
        ...loaded.content,
        editable: content.editable !== false && loaded.content.editable !== false,
      },
    };
  }
  const presentation = resolveFileRendererPresentation(content, Boolean(save));
  if (presentation.kind !== "markdown" || !save || !content.documentSource)
    throw new NativeDocumentSourceError(400, "native_document_not_editable", "This file view does not use shared text");
  const owner = { workbenchId: input.projectId, extensionId: view.extensionId };
  return {
    ...(await resolveNativeSource(deps, owner, content.documentSource)),
    owner,
    content,
    projectionTarget: { fileRendererId: input.fileRendererId, resource: input.resource, pageParams: input.pageParams },
  };
};
