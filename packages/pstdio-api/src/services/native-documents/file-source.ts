import {
  extensionRendererContextSchema,
  type NativeDocumentTarget,
  nativeFileContentSchema,
  resolveFileRendererPresentation,
} from "pstdio-api-contracts";
import { createReadBoundary } from "pstdio-extensions";
import { z } from "zod";
import type { ExtensionsRouteDeps } from "../../features/extensions/deps";
import { executeProjectExtensionCommand } from "../../features/extensions/execute-project-extension-command";
import { withNativeFileWrite } from "./file-write-context";
import { resolveNativeLoadedSource } from "./source-binding";

export class NativeDocumentSourceError extends Error {
  constructor(
    readonly status: 400 | 404 | 502,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

type FileTarget = NativeDocumentTarget & { projectId: string; signal?: AbortSignal };
const resolveFile = async (deps: ExtensionsRouteDeps, input: FileTarget) => {
  const snapshot = await createReadBoundary(input.signal)(() => deps.extensionRuntimeCatalog.get(input.projectId));
  const view = snapshot.runtime.views.find((view) => view.id === input.fileRendererId);
  const handler = (operation: string) =>
    snapshot.runtime.privateHandlers.find(
      (handler) =>
        handler.rendererId === view?.id && handler.rendererKind === "file" && handler.operation === operation,
    );
  const load = handler("load");
  const save = handler("save");
  if (!view || view.contribution.body.kind !== "file" || !load)
    throw new NativeDocumentSourceError(404, "native_document_view_unavailable", "This file view is unavailable");
  const renderer = extensionRendererContextSchema.parse({
    rendererId: view.id,
    projectId: input.projectId,
    resource: input.resource,
    pageParams: input.pageParams,
    invocation: { placement: "visible" },
  });
  const slot = {
    id: view.id,
    kind: "renderer" as const,
    context: {
      projectId: input.projectId,
      ...(input.resource ? { resourceType: input.resource.type, resourceId: input.resource.id } : {}),
    },
  };
  return { view, load, save, renderer, slot };
};

/** The registered extension resolves its source; browsers supply view identities, never source paths. */
export const loadNativeMarkdownFile = async (deps: ExtensionsRouteDeps, input: FileTarget) => {
  const { view, load, save, renderer, slot } = await resolveFile(deps, input);
  const result = await executeProjectExtensionCommand(deps, {
    projectId: input.projectId,
    commandId: load.id,
    signal: input.signal,
    body: {
      params: { renderer },
      resource: input.resource,
      source: "dashboard",
      metadata: { fileStorageVersions: {} },
      slot,
    },
  });
  if (!result.outcome.ok)
    throw new NativeDocumentSourceError(502, "native_document_load_failed", result.outcome.reason);
  const parsed = nativeFileContentSchema.safeParse(result.outcome.value ?? {});
  if (!parsed.success)
    throw new NativeDocumentSourceError(502, "native_document_load_failed", "The file view returned invalid content");
  const content = parsed.data;
  const presentation = resolveFileRendererPresentation(content, Boolean(save));
  if (presentation.kind !== "markdown" || !presentation.isEditable || !save || !content.documentSource)
    throw new NativeDocumentSourceError(
      400,
      "native_document_not_editable",
      "This file view does not use the shared Markdown editor",
    );
  const owner = { workbenchId: input.projectId, extensionId: view.extensionId };
  const fileStorageVersions = z.record(z.string(), z.string()).parse(result.outcome.data?.fileStorageVersions ?? {});
  const binding = await resolveNativeLoadedSource(deps, {
    owner,
    source: content.documentSource,
    content: content.content ?? "",
    versions: fileStorageVersions,
  });
  return {
    documentKey: binding.documentKey,
    owner,
    content,
    copy: binding.copy,
    saveHandlerId: save.id,
    fileStorageVersions,
  };
};

export const saveNativeMarkdownFile = async (
  deps: ExtensionsRouteDeps,
  input: FileTarget & {
    content: string;
    fileStorageVersions: Record<string, string>;
    projection?: {
      owner: { workbenchId: string; extensionId: string };
      documentKey: string;
      projectionKey: string;
      state: Uint8Array;
    };
  },
) => {
  const { save, renderer, slot } = await resolveFile(deps, input);
  if (!save)
    throw new NativeDocumentSourceError(
      400,
      "native_document_not_editable",
      "This file view does not use the shared Markdown editor",
    );
  const execute = () =>
    executeProjectExtensionCommand(deps, {
      projectId: input.projectId,
      commandId: save.id,
      signal: input.signal,
      body: {
        params: { renderer, content: input.content },
        resource: input.resource,
        source: "dashboard",
        metadata: { fileStorageVersions: input.fileStorageVersions },
        slot,
      },
    });
  const result = input.projection
    ? await withNativeFileWrite({ ...input.projection, storage: deps.extensionStorageService }, execute)
    : await execute();
  if (!result.outcome.ok)
    throw new NativeDocumentSourceError(502, "native_document_save_failed", result.outcome.reason);
  return {
    fileStorageVersions: z.record(z.string(), z.string()).parse(result.outcome.data?.fileStorageVersions ?? {}),
  };
};
