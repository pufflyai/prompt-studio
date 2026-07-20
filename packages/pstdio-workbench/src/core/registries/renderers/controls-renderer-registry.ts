import type { ContributionMetadata, RegisteredContributionMetadata } from "../../shared/contributions/metadata";
import { byContributionPriority, normalizeContributionMetadata } from "../../shared/contributions/metadata";
import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { ResourceRef } from "../resources/resource-registry";
import type { WorkbenchRendererRegistry, WorkbenchWidgetRenderInput } from "./renderer-registry";

export type ControlsRendererRegion = "main-right-menu" | "secondary" | "overlay";

export interface ControlsRendererLayout {
  region?: ControlsRendererRegion;
  defaultPx?: number;
  minPx?: number;
  maxPx?: number;
}

// The control declarations + current values a controls renderer resolves. `params`
// and `groups` are @pstdio/ui ParamEditor shapes; kept structural here so the core
// registry stays free of a UI dependency (the React view casts them).
export interface ControlsQueryResult {
  params?: unknown[];
  groups?: unknown[];
  values?: Record<string, unknown>;
  readOnly?: boolean;
}

export interface ControlsUpdateValueInput {
  controlId: string;
  value: unknown;
  values: Record<string, unknown>;
  resource?: ResourceRef;
}

export interface ControlsApplyInput {
  values: Record<string, unknown>;
  resource?: ResourceRef;
}

export interface ControlsResetInput {
  controlIds?: string[];
  resource?: ResourceRef;
}

export interface ControlsRendererContribution {
  id: string;
  title: string;
  resourceKind?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  layout?: ControlsRendererLayout;
  defaultValues?: Record<string, unknown>;

  /** Load the control declarations + current values for the active resource. */
  executeQuery(resource?: ResourceRef): Promise<ControlsQueryResult> | ControlsQueryResult;
  /** Live-save a single control edit. Omit for explicit-apply or read-only panels. */
  updateValue?(input: ControlsUpdateValueInput): Promise<void> | void;
  /** Commit the full value map from a sticky footer. */
  apply?(input: ControlsApplyInput): Promise<void> | void;
  /** Reset some or all controls to their defaults. */
  reset?(input: ControlsResetInput): Promise<void> | void;
  subscribe?: (listener: () => void) => Disposable | (() => void);
}

export interface RegisteredControlsRendererContribution
  extends ControlsRendererContribution,
    RegisteredContributionMetadata {}

export interface ControlsRendererStoreState {
  renderers: Record<string, RegisteredControlsRendererContribution>;
}

export interface ControlsRendererRefreshEvent {
  controlsRendererId: string;
}

export type ControlsRendererRefreshListener = (event: ControlsRendererRefreshEvent) => void;

// The React layer supplies the rendering for a controls widget. Set once on
// workbench mount via setControlsRendererImplementation so registerControlsRenderer
// can auto-register a widget renderer with the same id.
export type ControlsRendererImplementation = (
  input: WorkbenchWidgetRenderInput & { controlsRendererId: string },
) => unknown;

export interface CreateControlsRendererRegistryInput {
  rendererRegistry: WorkbenchRendererRegistry;
}

export interface ControlsRendererRegistry {
  controlsStore: WorkbenchStore<ControlsRendererStoreState>;
  registerControlsRenderer(contribution: ControlsRendererContribution, metadata?: ContributionMetadata): Disposable;
  setControlsRendererImplementation(impl: ControlsRendererImplementation): void;
  getControlsRenderer(id: string): RegisteredControlsRendererContribution | undefined;
  listControlsRenderers(): RegisteredControlsRendererContribution[];
  refreshControlsRenderer(id: string): void;
  onDidRefreshControlsRenderer(listener: ControlsRendererRefreshListener): Disposable;
}

export const createControlsRendererRegistry = (
  input: CreateControlsRendererRegistryInput,
): ControlsRendererRegistry => {
  const { rendererRegistry } = input;

  const controlsStore = createWorkbenchStore<ControlsRendererStoreState>({
    name: "workbench.controlsRenderers",
    initialState: { renderers: {} },
  });

  const refreshListeners = new Set<ControlsRendererRefreshListener>();
  let implementation: ControlsRendererImplementation = () => null;

  const requireControlsRenderer = (id: string) => {
    const renderer = controlsStore.getState().renderers[id];
    if (!renderer) throw new Error(`Controls renderer not registered: ${id}`);
    return renderer;
  };

  return {
    controlsStore,

    setControlsRendererImplementation(impl) {
      implementation = impl;
    },

    registerControlsRenderer(contribution, metadata) {
      const snapshot = controlsStore.getState();
      if (snapshot.renderers[contribution.id]) {
        throw new Error(`Controls renderer already registered: ${contribution.id}`);
      }

      const record = {
        ...normalizeContributionMetadata(metadata),
        ...contribution,
      } as RegisteredControlsRendererContribution;

      controlsStore.setState(
        { ...snapshot, renderers: { ...snapshot.renderers, [contribution.id]: record } },
        false,
        "registerControlsRenderer",
      );

      // Auto-register a widget renderer with the same id; the React-side
      // implementation looks up the contribution by id and renders the
      // WorkbenchControlsView component.
      const rendererDisposable = rendererRegistry.registerRenderer({
        id: contribution.id,
        render: (rendererInput) => implementation({ ...rendererInput, controlsRendererId: contribution.id }),
      });

      return createDisposable(() => {
        rendererDisposable.dispose();
        const current = controlsStore.getState();
        if (current.renderers[contribution.id] !== record) return;
        const { [contribution.id]: _removed, ...nextRenderers } = current.renderers;
        controlsStore.setState({ renderers: nextRenderers }, false, "unregisterControlsRenderer");
      });
    },

    getControlsRenderer(id) {
      return controlsStore.getState().renderers[id];
    },

    listControlsRenderers() {
      return Object.values(controlsStore.getState().renderers).sort(byContributionPriority);
    },

    refreshControlsRenderer(id) {
      requireControlsRenderer(id);
      const event = { controlsRendererId: id };
      for (const listener of refreshListeners) listener(event);
    },

    onDidRefreshControlsRenderer(listener) {
      refreshListeners.add(listener);
      return createDisposable(() => {
        refreshListeners.delete(listener);
      });
    },
  };
};
