import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { ResourceRef } from "../resources/resource-registry";
import type { WorkbenchPanelRenderInput, WorkbenchRendererRegistry } from "./renderer-registry";

// What a file renderer's load resolves to. The React layer dispatches to a
// markdown editor, a code editor, or an image preview based on `fileName` /
// `mimeType`; text-ish files carry `content`, images carry `dataUrl`.
export interface FileRendererContent {
  fileName?: string;
  /** Workspace-relative path shown above the file preview. */
  filePath?: string;
  mimeType?: string;
  content?: string;
  dataUrl?: string;
  // Shown by the editor when the content is empty (editable text only).
  placeholder?: string;
  /** Override contribution-level save support for one loaded file. */
  editable?: boolean;
  /** Request Monaco for text that automatic dispatch would open as markdown. */
  textRenderer?: "automatic" | "monaco";
  /** Represent a deliberate no-file selection without an editable blank document. */
  emptyState?: {
    title: string;
    description?: string;
  };
  /** Ordered backing-store revision when one is available. */
  revision?: string;
}

export interface FileRendererRefreshOrigin {
  rendererId: string;
  instanceId: string;
  operationId: string;
}

export interface FileRendererRefreshEnvelope {
  resourceUri?: string;
  origin?: FileRendererRefreshOrigin;
  revision?: string;
}

export interface FileRendererSaveResult {
  revision?: string;
}

export interface FileRendererContribution {
  id: string;
  title: string;
  resourceKind?: string;

  /** Resolve the file's content (and identity) for the bound resource. */
  load(resource: ResourceRef | undefined): Promise<FileRendererContent> | FileRendererContent;
  /** Persist edited text. Absent ⇒ read-only. Never called for images. */
  save?(
    resource: ResourceRef | undefined,
    content: string,
    origin?: FileRendererRefreshOrigin,
    // biome-ignore lint/suspicious/noConfusingVoidType: Existing synchronous save callbacks return void.
  ): Promise<FileRendererSaveResult | undefined> | FileRendererSaveResult | void;
}

export interface RegisteredFileRendererContribution extends FileRendererContribution, RegisteredContributionMetadata {}

export interface FileRendererStoreState {
  renderers: Record<string, RegisteredFileRendererContribution>;
}

export interface FileRendererRefreshEvent extends FileRendererRefreshEnvelope {
  fileRendererId: string;
}

export type FileRendererRefreshListener = (event: FileRendererRefreshEvent) => void;

// The React layer supplies the rendering for a file-renderer widget. Set once on
// workbench mount via setFileRendererImplementation so registerFileRenderer can
// auto-register a widget renderer with the same id.
export type FileRendererImplementation = (input: WorkbenchPanelRenderInput & { fileRendererId: string }) => unknown;

export interface CreateFileRendererRegistryInput {
  rendererRegistry: WorkbenchRendererRegistry;
}

export interface FileRendererRegistry {
  fileRendererStore: WorkbenchStore<FileRendererStoreState>;
  registerFileRenderer(contribution: FileRendererContribution, metadata?: ContributionMetadata): Disposable;
  setFileRendererImplementation(impl: FileRendererImplementation): void;
  getFileRenderer(id: string): RegisteredFileRendererContribution | undefined;
  listFileRenderers(): RegisteredFileRendererContribution[];
  refreshFileRenderer(id: string, event?: FileRendererRefreshEnvelope): void;
  onDidRefreshFileRenderer(listener: FileRendererRefreshListener): Disposable;
}

export const createFileRendererRegistry = (input: CreateFileRendererRegistryInput): FileRendererRegistry => {
  const { rendererRegistry } = input;

  const fileRendererStore = createWorkbenchStore<FileRendererStoreState>({
    name: "workbench.fileRenderers",
    initialState: { renderers: {} },
  });

  const refreshListeners = new Set<FileRendererRefreshListener>();
  let implementation: FileRendererImplementation = () => null;

  const requireFileRenderer = (id: string) => {
    const renderer = fileRendererStore.getState().renderers[id];
    if (!renderer) throw new Error(`File renderer not registered: ${id}`);
    return renderer;
  };

  return {
    fileRendererStore,

    setFileRendererImplementation(impl) {
      implementation = impl;
    },

    registerFileRenderer(contribution, metadata) {
      const snapshot = fileRendererStore.getState();
      if (snapshot.renderers[contribution.id]) throw new Error(`File renderer already registered: ${contribution.id}`);

      const record = {
        ...normalizeContributionMetadata(metadata),
        ...contribution,
      } as RegisteredFileRendererContribution;

      fileRendererStore.setState(
        { ...snapshot, renderers: { ...snapshot.renderers, [contribution.id]: record } },
        false,
        "registerFileRenderer",
      );

      // Auto-register a widget renderer with the same id; the React-side
      // implementation looks up the contribution by id and renders the
      // WorkbenchFileRendererView component.
      const rendererDisposable = rendererRegistry.registerRenderer({
        id: contribution.id,
        render: (rendererInput) => implementation({ ...rendererInput, fileRendererId: contribution.id }),
      });

      return createDisposable(() => {
        rendererDisposable.dispose();
        const current = fileRendererStore.getState();
        if (current.renderers[contribution.id] !== record) return;
        const { [contribution.id]: _removed, ...nextRenderers } = current.renderers;
        fileRendererStore.setState({ renderers: nextRenderers }, false, "unregisterFileRenderer");
      });
    },

    getFileRenderer(id) {
      return fileRendererStore.getState().renderers[id];
    },

    listFileRenderers(): RegisteredFileRendererContribution[] {
      return Object.values(fileRendererStore.getState().renderers).sort(byContributionPriority);
    },

    refreshFileRenderer(id, envelope = {}) {
      requireFileRenderer(id);
      const event = { fileRendererId: id, ...envelope };
      for (const listener of refreshListeners) listener(event);
    },

    onDidRefreshFileRenderer(listener) {
      refreshListeners.add(listener);
      return createDisposable(() => {
        refreshListeners.delete(listener);
      });
    },
  };
};
