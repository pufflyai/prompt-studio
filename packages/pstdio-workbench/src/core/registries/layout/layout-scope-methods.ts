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
  // Answers "was this scope entered with a layout the user already had?", sampled when
  // the scope becomes current. Reading persistence live would be wrong: entering a mode
  // restores and persists panels before the mode seeds, so a new scope would look like
  // a returning one and never get its defaults.
  let enteredWithLayout = input.persistence?.getLayout(undefined) !== undefined;
  const willChangeScope = createScopeEvent<LayoutScope | undefined>();
  const didChangeScope = createScopeEvent<LayoutScope | undefined>();

  const setPersistenceScope: LayoutModel["setPersistenceScope"] = (nextScope, scopeInput = {}) => {
    if (currentScope === nextScope) return;
    input.persistence?.setLayout(input.getLayout(), currentScope);
    willChangeScope.notify(nextScope);
    currentScope = nextScope;
    const incoming = input.persistence?.getLayout(currentScope);
    enteredWithLayout = incoming !== undefined;
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
    // Live: whether anything is stored for the active scope right now.
    hasPersistedLayout: () => input.persistence?.getLayout(currentScope) !== undefined,
    enteredWithPersistedLayout: () => enteredWithLayout,
    onDidChangePersistenceScope: didChangeScope.subscribe,
    onWillChangePersistenceScope: willChangeScope.subscribe,
    persistLayout: () => input.persistence?.setLayout(input.getLayout(), currentScope),
    setPersistenceScope,
  };
};
