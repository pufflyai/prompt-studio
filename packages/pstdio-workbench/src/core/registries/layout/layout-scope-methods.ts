import type { LayoutModel, LayoutPersistenceAdapter, LayoutScope } from "./layout-model-types";
import {
  carryPinnedWorkbenchChrome,
  carryWorkbenchRegionState,
  createScopeEvent,
  resolveScopedLayout,
} from "./layout-scope";
import type { WorkbenchLayout, WorkbenchRegion } from "./layout-types";

export interface CreateLayoutScopeMethodsInput {
  defaultRegionVisibility?: Partial<Record<WorkbenchRegion, boolean>>;
  getLayout(): WorkbenchLayout;
  persistence?: LayoutPersistenceAdapter;
  setLayout(layout: WorkbenchLayout, action: string): void;
}

// Owns the active persistence scope and the layout rotation that follows it. Kept
// beside the layout model so the model factory stays a wiring surface.
export const createLayoutScopeMethods = (input: CreateLayoutScopeMethodsInput) => {
  let currentScope: LayoutScope | undefined;
  const willChangeScope = createScopeEvent<LayoutScope | undefined>();
  const didChangeScope = createScopeEvent<LayoutScope | undefined>();

  const setPersistenceScope: LayoutModel["setPersistenceScope"] = (nextScope, scopeInput = {}) => {
    if (currentScope === nextScope) return;
    input.persistence?.setLayout(input.getLayout(), currentScope);
    willChangeScope.notify(nextScope);
    currentScope = nextScope;
    const incoming = input.persistence?.getLayout(currentScope);
    const scopedLayout = resolveScopedLayout(input.defaultRegionVisibility, incoming);
    // Module-owned chrome is global workbench structure. Project scopes replace
    // Location workspaces, but must not unmount pinned navigation and headers.
    const withPinnedChrome = carryPinnedWorkbenchChrome(input.getLayout(), scopedLayout);
    const nextLayout = carryWorkbenchRegionState(
      input.getLayout(),
      withPinnedChrome,
      scopeInput.carryRegionState ?? [],
    );
    input.setLayout(nextLayout, "setPersistenceScope");
    didChangeScope.notify(currentScope);
  };

  return {
    getPersistenceScope: () => currentScope,
    hasPersistedLayout: () => input.persistence?.getLayout(currentScope) !== undefined,
    onDidChangePersistenceScope: didChangeScope.subscribe,
    onWillChangePersistenceScope: willChangeScope.subscribe,
    persistLayout: () => input.persistence?.setLayout(input.getLayout(), currentScope),
    setPersistenceScope,
  };
};
