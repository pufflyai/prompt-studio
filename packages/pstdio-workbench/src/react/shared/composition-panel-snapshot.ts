import type {
  ResourceRef,
  WorkbenchCompositionAddablePanel,
  WorkbenchCompositionRegionPanels,
  WorkbenchCore,
  WorkbenchPanelRegion,
} from "../../core";

const sameList = (left: readonly unknown[], right: readonly unknown[]) =>
  left.length === right.length && left.every((value, index) => value === right[index]);
const sameRecord = (left: object, right: object) =>
  Object.keys(left).length === Object.keys(right).length &&
  Object.keys(left).every((key) => Reflect.get(left, key) === Reflect.get(right, key));
const sameChoice = (left: WorkbenchCompositionAddablePanel, right: WorkbenchCompositionAddablePanel) =>
  left.panelId === right.panelId &&
  left.region === right.region &&
  left.pinned === right.pinned &&
  Boolean(left.open) === Boolean(right.open) &&
  sameList(left.allowedRegions ?? [], right.allowedRegions ?? []) &&
  sameRecord(left.contribution, right.contribution);

const retainChoice = (choice: WorkbenchCompositionAddablePanel) => {
  let open = choice.open;
  return {
    value: { ...choice, open: open ? (resource?: ResourceRef) => open?.(resource) : undefined },
    update(next: WorkbenchCompositionAddablePanel) {
      open = next.open;
    },
  };
};

/** Render only changed choices, while an unchanged button still invokes its current owner action. */
export const createCompositionPanelSnapshot = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  const stores = [
    workbench.layout.store,
    workbench.modes.store,
    workbench.pages.store,
    workbench.commands.store,
    workbench.context.store,
  ];
  let inputs: unknown[] = [];
  let snapshot: WorkbenchCompositionRegionPanels | undefined;
  let choices = new Map<string, ReturnType<typeof retainChoice>>();
  const refresh = () => {
    inputs = stores.map((store) => store.getState());
    const next = workbench.composition.panelsFor(region);
    const retained = new Map<string, ReturnType<typeof retainChoice>>();
    const addable = next.addable.map((choice) => {
      let current = choices.get(choice.panelId);
      if (!current || !sameChoice(current.value, choice)) current = retainChoice(choice);
      else current.update(choice);
      retained.set(choice.panelId, current);
      return current.value;
    });
    choices = retained;
    if (
      !snapshot ||
      !sameList(snapshot.open, next.open) ||
      !sameList(snapshot.addable, addable) ||
      !sameList(snapshot.closable, next.closable)
    )
      snapshot = { ...next, addable };
    return snapshot;
  };
  return {
    refresh,
    read() {
      if (!snapshot || stores.some((store, index) => store.getState() !== inputs[index])) return refresh();
      return snapshot;
    },
    subscribe(changed: () => void) {
      const stops = stores.map((store) => store.subscribe(changed));
      return () => {
        for (const stop of stops) stop();
      };
    },
  };
};

const readers = new WeakMap<
  WorkbenchCore,
  Map<WorkbenchPanelRegion, ReturnType<typeof createCompositionPanelSnapshot>>
>();
export const compositionPanelSnapshot = (workbench: WorkbenchCore, region: WorkbenchPanelRegion) => {
  let regions = readers.get(workbench);
  if (!regions) {
    regions = new Map();
    readers.set(workbench, regions);
  }
  let reader = regions.get(region);
  if (!reader) {
    reader = createCompositionPanelSnapshot(workbench, region);
    regions.set(region, reader);
  }
  return reader;
};
