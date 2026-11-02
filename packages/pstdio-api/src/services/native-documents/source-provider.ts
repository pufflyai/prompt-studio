import { nativeDocumentSourceSchema, type TextSourceTarget } from "pstdio-api-contracts";
import { z } from "zod";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { executeProjectExtensionCommand } from "../../features/extensions/execute-project-extension-command";
import { resolveNativeLoadedSource } from "./source-binding";
import { NativeDocumentSourceError } from "./source-error";

export type ProviderTarget = TextSourceTarget & { projectId: string; signal?: AbortSignal };
const resolution = z.strictObject({ source: nativeDocumentSourceSchema, content: z.string(), editable: z.boolean() });
const versions = z.record(z.string(), z.string());
const invoke = async (
  deps: ExtensionsRouteDeps,
  input: ProviderTarget,
  operation: "resolve" | "project",
  metadata: Record<string, string>,
  content?: string,
) => {
  const id = `${input.extensionId}.text-source.${input.textDocument.sourceId}`;
  const snapshot = await deps.extensionRuntimeCatalog.get(input.projectId);
  const handler = snapshot.runtime.privateHandlers.find(
    (entry) =>
      entry.rendererKind === "textSource" &&
      entry.rendererId === id &&
      entry.operation === operation &&
      entry.extensionId === input.extensionId,
  );
  if (!handler)
    throw new NativeDocumentSourceError(
      404,
      "native_document_source_unavailable",
      "The text source provider is unavailable",
    );
  const result = await executeProjectExtensionCommand(deps, {
    projectId: input.projectId,
    commandId: handler.id,
    signal: input.signal,
    body: {
      params: {
        params: input.textDocument.params,
        ...(input.textDocument.resource && { resource: input.textDocument.resource }),
        ...(content !== undefined && { content }),
      },
      resource: input.textDocument.resource,
      source: "dashboard",
      metadata: { fileStorageVersions: metadata },
    },
  });
  if (!result.outcome.ok) {
    if (result.outcome.error?.name === "StorageRevisionChangedError") {
      const { StorageRevisionChangedError } = await import("pstdio-sync");
      throw new StorageRevisionChangedError();
    }
    throw new NativeDocumentSourceError(502, `native_document_${operation}_failed`, result.outcome.reason);
  }
  return {
    value: result.outcome.value,
    fileStorageVersions: versions.parse(result.outcome.data?.fileStorageVersions ?? {}),
  };
};

export const resolveTextProvider = async (deps: ExtensionsRouteDeps, input: ProviderTarget) => {
  const result = await invoke(deps, input, "resolve", {});
  return {
    resolved: resolution.parse(result.value),
    owner: { workbenchId: input.projectId, extensionId: input.extensionId },
    fileStorageVersions: result.fileStorageVersions,
  };
};

export const loadTextSource = async (deps: ExtensionsRouteDeps, input: ProviderTarget) => {
  const { resolved, owner, fileStorageVersions } = await resolveTextProvider(deps, input);
  const binding = await resolveNativeLoadedSource(deps, {
    owner,
    source: resolved.source,
    content: resolved.content,
    versions: fileStorageVersions,
  });
  return {
    ...binding,
    owner,
    content: { content: resolved.content, editable: resolved.editable, documentSource: resolved.source },
    fileStorageVersions: binding.fileStorageVersions,
    saveHandlerId: `${input.extensionId}.text-source.${input.textDocument.sourceId}.textSource.project`,
    projectionTarget: { extensionId: input.extensionId, textDocument: input.textDocument },
  };
};

export const projectTextSource = async (
  deps: ExtensionsRouteDeps,
  input: ProviderTarget & { content: string; fileStorageVersions: Record<string, string> },
) => invoke(deps, input, "project", input.fileStorageVersions, input.content);
