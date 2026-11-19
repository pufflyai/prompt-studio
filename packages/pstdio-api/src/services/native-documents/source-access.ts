import {
  type NativeDocumentSource,
  type NativeTextTarget,
  resolveFileRendererPresentation,
} from "pstdio-api-contracts";
import type { StorageOwner } from "pstdio-sync";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { resolveNativeFilePresentation } from "./file-source";
import { resolveNativeLoadedSource, resolveNativeSource } from "./source-binding";
import { NativeDocumentSourceError } from "./source-error";
import { isRecordFieldSource } from "./source-kind";
import { type ProviderTarget, resolveTextProvider } from "./source-provider";

/** Authority checks need source identity and access, independent of a physical load observation. */
export type NativeSourceAccess = Pick<
  Awaited<ReturnType<typeof resolveNativeTextAccess>>,
  "owner" | "documentKey" | "lifetime" | "generation" | "content" | "projectionTarget"
> & { backingRecordId?: string | null; verifiedRecordField?: boolean };

// Record fields have a single storage authority. Its revision and full bytes can be
// checked against this handler invocation without taking the physical-file projection queue.
const accessBinding = async (
  deps: ExtensionsRouteDeps,
  input: { owner: StorageOwner; source: NativeDocumentSource; content: string; versions: Record<string, string> },
  verifyRecordField?: boolean,
) =>
  verifyRecordField && isRecordFieldSource(input.source)
    ? { ...(await resolveNativeLoadedSource(deps, input)), verifiedRecordField: true }
    : resolveNativeSource(deps, input.owner, input.source);

const resolveProviderAccess = async (deps: ExtensionsRouteDeps, input: ProviderTarget, verifyRecordField?: boolean) => {
  const { resolved, owner, fileStorageVersions } = await resolveTextProvider(deps, input);
  return {
    ...(await accessBinding(
      deps,
      { owner, source: resolved.source, content: resolved.content, versions: fileStorageVersions },
      verifyRecordField,
    )),
    owner,
    content: { content: resolved.content, editable: resolved.editable, documentSource: resolved.source },
    projectionTarget: { extensionId: input.extensionId, textDocument: input.textDocument },
  };
};

/** Recheck domain access and identity without importing a physical byte observation into the text authority. */
export const resolveNativeTextAccess = async (
  deps: ExtensionsRouteDeps,
  input: NativeTextTarget & { projectId: string; signal?: AbortSignal; verifyRecordField?: boolean },
) => {
  if ("textDocument" in input) return resolveProviderAccess(deps, input, input.verifyRecordField);
  const { view, save, content, fileStorageVersions } = await resolveNativeFilePresentation(deps, input);
  if (content.textDocument) {
    if (content.documentSource)
      throw new NativeDocumentSourceError(
        400,
        "native_document_source_invalid",
        "A file view must declare only one text source",
      );
    const loaded = await resolveProviderAccess(
      deps,
      {
        projectId: input.projectId,
        signal: input.signal,
        extensionId: view.extensionId,
        textDocument: content.textDocument,
      },
      input.verifyRecordField,
    );
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
    ...(await accessBinding(
      deps,
      { owner, source: content.documentSource, content: content.content ?? "", versions: fileStorageVersions },
      input.verifyRecordField && presentation.isEditable,
    )),
    owner,
    content,
    projectionTarget: { fileRendererId: input.fileRendererId, resource: input.resource, pageParams: input.pageParams },
  };
};
