import { notifyWorkbenchChange } from "../../shared/store/workbench-batch";
import { runWorkbenchEffect } from "../../shared/workbench-effect";
import { createWorkbenchEvent } from "../../shared/workbench-event";
import type { LayoutModel, LayoutPersistenceAdapter, LayoutScope } from "./layout-model-types";
import { carryPinnedWorkbenchChrome, carryWorkbenchRegionState, resolveScopedLayout } from "./layout-scope";
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
  let enteredWithLayout =
    runWorkbenchEffect("layout cache read for unscoped", () => input.persistence?.getLayout(undefined)) !== undefined;
  const willChangeScope = createWorkbenchEvent<LayoutScope | undefined>("layout scope subscriber");
  const didChangeScope = createWorkbenchEvent<LayoutScope | undefined>("layout scope subscriber");
  const pending = new Map<LayoutScope | undefined, { layout: WorkbenchLayout }>();
  const readLayout = (scope: LayoutScope | undefined) =>
    pending.get(scope)?.layout ?? input.persistence?.getLayout(scope);

  const persistLayout = () => {
    if (!input.persistence) return;
    const scope = currentScope;
    const previous = pending.get(scope);
    if (previous) {
      previous.layout = input.getLayout();
      return;
    }
    const write = { layout: input.getLayout() };
    pending.set(scope, write);
    // Module transitions register and remove many panels. Persist their completed
    // layout once, retaining the outgoing scope if that same transition switches projects.
    notifyWorkbenchChange(write, () => {
      pending.delete(scope);
      runWorkbenchEffect(`layout cache for ${scope ?? "unscoped"}`, () =>
        input.persistence?.setLayout(write.layout, scope),
      );
    });
  };

  const setPersistenceScope: LayoutModel["setPersistenceScope"] = (nextScope, scopeInput = {}) => {
    if (currentScope === nextScope) return;
    persistLayout();
    willChangeScope.notify(nextScope);
    currentScope = nextScope;
    const incoming = runWorkbenchEffect(`layout cache read for ${currentScope ?? "unscoped"}`, () =>
      readLayout(currentScope),
    );
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
    hasPersistedLayout: () =>
      runWorkbenchEffect(`layout cache read for ${currentScope ?? "unscoped"}`, () => readLayout(currentScope)) !==
      undefined,
    enteredWithPersistedLayout: () => enteredWithLayout,
    onDidChangePersistenceScope: didChangeScope.subscribe,
    onWillChangePersistenceScope: willChangeScope.subscribe,
    persistLayout,
    setPersistenceScope,
  };
};
