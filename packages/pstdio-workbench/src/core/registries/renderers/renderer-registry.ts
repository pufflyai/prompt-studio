import { createDisposable, type Disposable } from "../../shared/disposable";
import { createWorkbenchStore, type WorkbenchStore } from "../../shared/store/workbench-store";
import type { WorkbenchCore } from "../../workbench-core";
import type {
  RegisteredPlaceholderContribution,
  RegisteredWidgetContribution,
  WorkbenchWidgetPlacement,
} from "../layout/layout-model";

export interface WorkbenchWidgetRenderInput {
  workbench: WorkbenchCore;
  widget: RegisteredWidgetContribution | RegisteredPlaceholderContribution;
  placement: WorkbenchWidgetPlacement;
  refresh: () => void;
}

// Keep-alive renderers are invoked exactly once into a persistent host and
// reparented across widget mounts via DOM moves. They cannot read the per-widget
// `WorkbenchWidgetRenderInput` from their render args — the subtree subscribes
// to the current claim through `useWorkbenchClaim()` (React layer) instead.
export type WorkbenchRendererRegistration =
  | {
      id: string;
      keepAlive?: false;
      render: (input: WorkbenchWidgetRenderInput) => unknown;
    }
  | {
      id: string;
      keepAlive: true;
      render: () => unknown;
    };

export type WorkbenchRendererChangeListener = () => void;

export interface RegisteredKeepAliveHost {
  rendererId: string;
  host: HTMLElement;
  attachedTo?: HTMLElement;
}

export interface WorkbenchRendererStoreState {
  renderers: Record<string, WorkbenchRendererRegistration>;
  hosts: Record<string, RegisteredKeepAliveHost>;
  claims: Record<string, WorkbenchWidgetRenderInput>;
}

export interface WorkbenchRendererRegistry {
  store: WorkbenchStore<WorkbenchRendererStoreState>;
  registerRenderer(renderer: WorkbenchRendererRegistration): Disposable;
  getRenderer(id: string): WorkbenchRendererRegistration | undefined;
  listRenderers(): WorkbenchRendererRegistration[];
  onDidChange(listener: WorkbenchRendererChangeListener): Disposable;
  claim(rendererId: string, placementId: string, slot: HTMLElement, input: WorkbenchWidgetRenderInput): Disposable;
  getHost(placementId: string): HTMLElement | undefined;
  getClaim(placementId: string): WorkbenchWidgetRenderInput | undefined;
}

export interface CreateWorkbenchRendererRegistryInput {
  initialRenderers?: WorkbenchRendererRegistration[];
  // Override for environments without a real DOM (Bun tests). Default reads
  // `document`; SSR callers without DOM should provide their own factory.
  createHost?: () => HTMLElement;
}

const removeKey = <T>(record: Record<string, T>, key: string): Record<string, T> => {
  const { [key]: _removed, ...rest } = record;
  return rest;
};

const isSameClaimInput = (left: WorkbenchWidgetRenderInput | undefined, right: WorkbenchWidgetRenderInput) =>
  left?.workbench === right.workbench &&
  left.widget === right.widget &&
  left.placement === right.placement &&
  left.refresh === right.refresh;

const defaultCreateHost = () => {
  if (typeof document === "undefined") {
    throw new Error(
      "workbench.renderers.registerRenderer({ keepAlive: true }): no DOM available. " +
        "The default host factory uses document.createElement. In a non-browser environment " +
        "(Bun tests, SSR), pass a custom factory via " +
        "createWorkbenchCore({ renderers: { createHost: () => myHost } }).",
    );
  }
  const host = document.createElement("div");
  host.style.display = "contents";
  host.dataset.workbenchKeepAliveHost = "";
  return host;
};

export const createWorkbenchRendererRegistry = (
  input: CreateWorkbenchRendererRegistryInput = {},
): WorkbenchRendererRegistry => {
  const createHost = input.createHost ?? defaultCreateHost;

  const store = createWorkbenchStore<WorkbenchRendererStoreState>({
    name: "workbench.renderers",
    initialState: { renderers: {}, hosts: {}, claims: {} },
  });

  // Detach the host of `placementId` from its current slot (if any) and clear
  // the matching claim. Used before reparenting and before unregistering.
  const detachHost = (placementId: string) => {
    const snapshot = store.getState();
    const hostState = snapshot.hosts[placementId];
    const previousSlot = hostState?.attachedTo;
    if (!hostState || !previousSlot) return;

    if (previousSlot.contains(hostState.host)) previousSlot.removeChild(hostState.host);

    store.setState(
      {
        ...snapshot,
        hosts: { ...snapshot.hosts, [placementId]: { ...hostState, attachedTo: undefined } },
        claims: removeKey(snapshot.claims, placementId),
      },
      false,
      "renderers.detach",
    );
  };

  const registry: WorkbenchRendererRegistry = {
    store,

    registerRenderer(renderer) {
      const snapshot = store.getState();
      if (snapshot.renderers[renderer.id]) throw new Error(`Renderer already registered: ${renderer.id}`);

      store.setState(
        { ...snapshot, renderers: { ...snapshot.renderers, [renderer.id]: renderer } },
        false,
        "registerRenderer",
      );

      return createDisposable(() => {
        const current = store.getState();
        if (current.renderers[renderer.id] !== renderer) return;

        const placementIds = Object.entries(current.hosts)
          .filter(([, hostState]) => hostState.rendererId === renderer.id)
          .map(([placementId]) => placementId);

        for (const placementId of placementIds) detachHost(placementId);

        const after = store.getState();
        const hosts = placementIds.reduce((result, placementId) => removeKey(result, placementId), after.hosts);
        const claims = placementIds.reduce((result, placementId) => removeKey(result, placementId), after.claims);
        store.setState(
          {
            ...after,
            renderers: removeKey(after.renderers, renderer.id),
            hosts,
            claims,
          },
          false,
          "unregisterRenderer",
        );
      });
    },

    getRenderer(id) {
      return store.getState().renderers[id];
    },

    listRenderers() {
      return Object.values(store.getState().renderers);
    },

    onDidChange(listener) {
      const unsubscribe = store.subscribeSelector(
        (state) => state.renderers,
        () => listener(),
      );
      return createDisposable(unsubscribe);
    },

    claim(rendererId, placementId, slot, claimInput) {
      const snapshot = store.getState();
      const renderer = snapshot.renderers[rendererId];
      if (!renderer) throw new Error(`Renderer is not registered: ${rendererId}`);
      if (!renderer.keepAlive) throw new Error(`Renderer ${rendererId} is not keep-alive; cannot claim`);

      const hostState = snapshot.hosts[placementId] ?? { rendererId, host: createHost() };

      // If already attached to this slot, only update the claim input and
      // skip the DOM move so re-renders with the same slot stay quiet.
      if (hostState.attachedTo === slot) {
        if (!isSameClaimInput(snapshot.claims[placementId], claimInput)) {
          store.setState(
            { ...snapshot, claims: { ...snapshot.claims, [placementId]: claimInput } },
            false,
            "renderers.updateClaim",
          );
        }
      } else {
        detachHost(placementId);
        const next = store.getState();
        const refreshedHostState = next.hosts[placementId] ?? hostState;
        slot.appendChild(refreshedHostState.host);
        store.setState(
          {
            ...next,
            hosts: { ...next.hosts, [placementId]: { ...refreshedHostState, attachedTo: slot } },
            claims: { ...next.claims, [placementId]: claimInput },
          },
          false,
          "renderers.attach",
        );
      }

      return createDisposable(() => {
        const current = store.getState();
        const currentHostState = current.hosts[placementId];
        if (!currentHostState || currentHostState.attachedTo !== slot) return;
        detachHost(placementId);
      });
    },

    getHost(placementId) {
      return store.getState().hosts[placementId]?.host;
    },

    getClaim(placementId) {
      return store.getState().claims[placementId];
    },
  };

  for (const renderer of input.initialRenderers ?? []) registry.registerRenderer(renderer);

  return registry;
};
